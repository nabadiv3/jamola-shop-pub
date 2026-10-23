import "dotenv/config";

import express from "express";

import cors from "cors";

import mongoose from "mongoose";

import bcrypt from "bcryptjs";

import jwt from "jsonwebtoken";

import { rateLimit } from "express-rate-limit";

import { User, Product, Order } from "./models.js";

const app = express();

const PORT = Number(process.env.PORT) || 5000;

const TOKEN_ISSUER = "jamola-server";

const TOKEN_AUDIENCE = "jamola-client";

/* Environment */

if (!process.env.MONGO_URI || process.env.MONGO_URI.includes("PUT_YOUR")) {
  throw new Error("Add your MongoDB connection string to .env");
}

if (
  !process.env.JWT_SECRET ||
  process.env.JWT_SECRET.length < 48 ||
  process.env.JWT_SECRET.includes("PUT_A_LONG")
) {
  throw new Error("Add a long random JWT_SECRET to .env");
}

const allowedOrigins = (
  process.env.CLIENT_ORIGINS || "http://localhost:5173,http://localhost:5174"
)

  .split(",")

  .map((origin) => origin.trim())

  .filter(Boolean);

/* Middleware */

app.disable("x-powered-by");

app.use(
  cors({
    origin: allowedOrigins,

    methods: ["GET", "POST", "PATCH", "DELETE"],

    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json({ limit: "100kb" }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,

  limit: 30,

  standardHeaders: true,

  legacyHeaders: false,

  message: {
    message: "Too many attempts. Please try again later.",
  },
});

/* Helpers */

function fail(status, message) {
  const error = new Error(message);

  error.status = status;

  throw error;
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function validId(value) {
  return typeof value === "string" && mongoose.isObjectIdOrHexString(value);
}

function safeUser(user) {
  return {
    id: user._id.toString(),

    name: user.name,

    email: user.email,

    role: user.role,
  };
}

function productResponse(product) {
  const data =
    typeof product.toObject === "function" ? product.toObject() : product;

  const { _id, __v, ...fields } = data;

  return {
    ...fields,

    id: _id.toString(),
  };
}

function orderResponse(order) {
  const data = typeof order.toObject === "function" ? order.toObject() : order;

  const { _id, __v, ...fields } = data;

  return {
    ...fields,

    id: _id.toString(),
  };
}

function createToken(user) {
  return jwt.sign({}, process.env.JWT_SECRET, {
    algorithm: "HS256",

    subject: user._id.toString(),

    issuer: TOKEN_ISSUER,

    audience: TOKEN_AUDIENCE,

    expiresIn: "2h",
  });
}

function validateCredentials(body, registration = false) {
  const email = text(body.email).toLowerCase();

  const password = typeof body.password === "string" ? body.password : "";

  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fail(400, "Enter a valid email address.");
  }

  if (password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
    fail(400, "Password must be at least 8 characters and at most 72 bytes.");
  }

  const name = text(body.name);

  if (registration && (name.length < 2 || name.length > 80)) {
    fail(400, "Name must contain 2 to 80 characters.");
  }

  return { email, password, name };
}

/* Authentication */

async function protect(req, res, next) {
  const authorization = req.headers.authorization || "";

  if (!authorization.startsWith("Bearer ")) {
    fail(401, "Please sign in.");
  }

  const token = authorization.slice(7);

  let payload;

  try {
    payload = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],

      issuer: TOKEN_ISSUER,

      audience: TOKEN_AUDIENCE,
    });
  } catch {
    fail(401, "Your session expired. Please sign in again.");
  }

  if (typeof payload !== "object" || !validId(payload.sub)) {
    fail(401, "Invalid session.");
  }

  const user = await User.findById(payload.sub);

  if (!user) {
    fail(401, "Account not found. Please sign in again.");
  }

  req.user = user;

  next();
}

function adminOnly(req, res, next) {
  if (req.user.role !== "admin") {
    fail(403, "Administrator access required.");
  }

  next();
}

/* Health */

app.get("/", (req, res) => {
  res.json({
    name: "NABO BEAUTY API",

    status: "running",
  });
});

/* Register */

app.post("/api/auth/register", authLimiter, async (req, res) => {
  const { name, email, password } = validateCredentials(req.body || {}, true);

  const exists = await User.exists({ email });

  if (exists) {
    fail(409, "An account with this email already exists.");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await User.create({
    name,

    email,

    passwordHash,

    role: "customer",
  });

  res.status(201).json({
    user: safeUser(user),

    token: createToken(user),
  });
});

/* Login */

app.post("/api/auth/login", authLimiter, async (req, res) => {
  const { email, password } = validateCredentials(req.body || {});

  const user = await User.findOne({ email }).select("+passwordHash");

  const matched = user && (await bcrypt.compare(password, user.passwordHash));

  if (!matched) {
    fail(401, "Email or password is incorrect.");
  }

  res.json({
    user: safeUser(user),

    token: createToken(user),
  });
});

/* Current user */

app.get("/api/auth/me", protect, (req, res) => {
  res.json({
    user: safeUser(req.user),
  });
});

/* Catalog helpers: search, filtering, sorting and pagination */

// Query parsing is deliberately strict: reject arrays, objects and invalid numbers.
const CATEGORIES = ["Eyes", "Lips", "Face", "Nails", "Skincare", "Fragrance"];
const SORTS = {
  featured: { catalogId: 1, createdAt: -1, _id: 1 },
  low: { price: 1, _id: 1 },
  high: { price: -1, _id: 1 },
  name: { name: 1, _id: 1 },
};

function bad(message) {
  throw Object.assign(new Error(message), { status: 400 });
}

function scalar(query, key, fallback = "") {
  const value = query[key];
  if (value === undefined) return fallback;
  if (typeof value !== "string") bad(`${key} must be a single value.`);
  return value.trim();
}

function integer(value, label, min, max) {
  if (!/^\d+$/.test(value)) bad(`${label} must be an integer.`);
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max) {
    bad(`${label} must be between ${min} and ${max}.`);
  }
  return number;
}

function parseCatalogQuery(query) {
  const legacyRequest = query.page === undefined && query.limit === undefined;
  const page = integer(scalar(query, "page", "1"), "page", 1, 100000);
  const limit = integer(
    scalar(query, "limit", legacyRequest ? "200" : "12"),
    "limit",
    1,
    legacyRequest ? 200 : 48,
  );
  const search = scalar(query, "search");
  if (search.length > 100) bad("Search is limited to 100 characters.");
  const category = scalar(query, "category", "All") || "All";
  if (category !== "All" && !CATEGORIES.includes(category))
    bad("Invalid category.");
  const sort = scalar(query, "sort", "featured");
  if (!Object.hasOwn(SORTS, sort)) bad("Invalid sort option.");
  const inStock = scalar(query, "inStock", "false");
  if (!["true", "false"].includes(inStock))
    bad("inStock must be true or false.");
  const minimum = scalar(query, "minPrice");
  const maximum = scalar(query, "maxPrice");
  const minPrice =
    minimum === "" ? null : integer(minimum, "minPrice", 0, 1000000000);
  const maxPrice =
    maximum === "" ? null : integer(maximum, "maxPrice", 0, 1000000000);
  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    bad("Minimum price cannot exceed maximum price.");
  }
  const filter = { active: true };
  if (category !== "All") filter.category = category;
  if (inStock === "true") filter.stock = { $gt: 0 };
  if (minPrice !== null || maxPrice !== null) {
    filter.price = {};
    if (minPrice !== null) filter.price.$gte = minPrice;
    if (maxPrice !== null) filter.price.$lte = maxPrice;
  }
  if (search) {
    // Treat regex characters as ordinary text, not user supplied patterns.
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = ["name", "brand", "category"].map((field) => ({
      [field]: { $regex: escaped, $options: "i" },
    }));
  }
  return { page, limit, filter, sort: SORTS[sort] };
}

async function listProducts(Product, query) {
  const parsed = parseCatalogQuery(query);
  const total = await Product.countDocuments(parsed.filter);
  const totalPages = Math.ceil(total / parsed.limit);
  // A saved page may disappear after products are removed. Clamp it safely.
  const page = Math.min(parsed.page, Math.max(totalPages, 1));
  const products = await Product.find(parsed.filter)
    .sort(parsed.sort)
    .skip((page - 1) * parsed.limit)
    .limit(parsed.limit);
  return {
    products,
    pagination: {
      page,
      limit: parsed.limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: total > 0 && page > 1,
    },
  };
}

/* Products */

app.get("/api/products", async (req, res) => {
  const result = await listProducts(Product, req.query);
  res.json({
    products: result.products.map(productResponse),
    pagination: result.pagination,
  });
});

/* Fetch only saved product IDs, independent of catalog pages or filters. */
app.get("/api/products/lookup", async (req, res) => {
  const value = req.query.ids;
  if (typeof value !== "string" || value.length > 2500) {
    fail(400, "Provide a comma-separated product ID list.");
  }
  const ids = [...new Set(value.split(",").filter(Boolean))];
  if (ids.length > 100 || ids.some((id) => !validId(id))) {
    fail(400, "Provide up to 100 valid product IDs.");
  }
  const products = ids.length
    ? await Product.find({ _id: { $in: ids }, active: true })
    : [];
  res.json({ products: products.map(productResponse) });
});

/* One product */

app.get("/api/products/:id", async (req, res) => {
  if (!validId(req.params.id)) {
    fail(404, "Product not found.");
  }

  const product = await Product.findOne({
    _id: req.params.id,

    active: true,
  });

  if (!product) {
    fail(404, "Product not found.");
  }

  res.json({
    product: productResponse(product),
  });
});

/* Create order */

app.post("/api/orders", protect, async (req, res) => {
  const body = req.body || {};

  const customer = body.customer || {};

  const delivery = {
    name: text(customer.name),

    phone: text(customer.phone),

    city: text(customer.city),

    address: text(customer.address),
  };

  if (delivery.name.length < 2 || delivery.name.length > 80) {
    fail(400, "Full name must contain 2 to 80 characters.");
  }

  if (!/^[+0-9 ()-]{8,20}$/.test(delivery.phone)) {
    fail(400, "Enter a valid phone number using English digits.");
  }

  if (delivery.city.length < 2 || delivery.city.length > 80) {
    fail(400, "City must contain 2 to 80 characters.");
  }

  if (delivery.address.length < 10 || delivery.address.length > 300) {
    fail(
      400,

      "Address must contain 10 to 300 characters. Include your area, street and nearest landmark.",
    );
  }

  if (
    !Array.isArray(body.items) ||
    body.items.length === 0 ||
    body.items.length > 50
  ) {
    fail(400, "Your bag must contain 1 to 50 different products.");
  }

  const ids = new Set();

  for (const item of body.items) {
    if (
      !item ||
      !validId(item.productId) ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 10
    ) {
      fail(400, "Invalid product or quantity.");
    }

    if (ids.has(item.productId)) {
      fail(400, "Combine duplicate products into one item.");
    }

    ids.add(item.productId);
  }

  const products = await Product.find({
    _id: { $in: [...ids] },

    active: true,
  });

  const lookup = new Map(
    products.map((product) => [product._id.toString(), product]),
  );

  const items = body.items.map((item) => {
    const product = lookup.get(item.productId);

    if (!product) {
      fail(400, "One of the products is no longer available.");
    }

    if (product.stock < item.quantity) {
      fail(409, `${product.name} does not have enough stock.`);
    }

    return {
      product: product._id,

      name: product.name,

      image: product.image,

      price: product.price,

      quantity: item.quantity,
    };
  });

  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,

    0,
  );

  const shipping = subtotal >= 75000 ? 0 : 5000;

  const order = await Order.create({
    user: req.user._id,

    customer: delivery,

    items,

    subtotal,

    shipping,

    total: subtotal + shipping,
  });

  res.status(201).json({
    order: orderResponse(order),
  });
});

/* My orders */

app.get("/api/orders/my", protect, async (req, res) => {
  const orders = await Order.find({
    user: req.user._id,
  })

    .sort({ createdAt: -1 })

    .limit(100);

  res.json({
    orders: orders.map(orderResponse),
  });
});

/* Product validation */

function productInput(body, partial = false) {
  const result = {};

  const stringFields = {
    name: 150,

    brand: 100,

    shade: 150,

    badge: 50,

    description: 3000,
  };

  for (const [field, maximum] of Object.entries(stringFields)) {
    if (Object.hasOwn(body, field)) {
      if (typeof body[field] !== "string") {
        fail(400, `${field} must be text.`);
      }

      const value = body[field].trim();

      if (value.length > maximum) {
        fail(400, `${field} is too long.`);
      }

      result[field] = value;
    }
  }

  if (!partial && (!result.name || !result.brand)) {
    fail(400, "Product name and brand are required.");
  }

  if (
    (Object.hasOwn(result, "name") && !result.name) ||
    (Object.hasOwn(result, "brand") && !result.brand)
  ) {
    fail(400, "Name and brand cannot be empty.");
  }

  const categories = ["Eyes", "Lips", "Face", "Nails", "Skincare", "Fragrance"];

  if (Object.hasOwn(body, "category")) {
    if (!categories.includes(body.category)) {
      fail(400, "Invalid category.");
    }

    result.category = body.category;
  } else if (!partial) {
    fail(400, "Category is required.");
  }

  for (const field of ["price", "stock"]) {
    if (Object.hasOwn(body, field)) {
      if (!Number.isSafeInteger(body[field]) || body[field] < 0) {
        fail(400, `${field} must be a non-negative integer.`);
      }

      result[field] = body[field];
    }
  }

  if (!partial && result.price === undefined) {
    fail(400, "Price is required.");
  }

  if (Object.hasOwn(body, "oldPrice")) {
    if (
      body.oldPrice !== null &&
      (!Number.isSafeInteger(body.oldPrice) || body.oldPrice < 0)
    ) {
      fail(400, "Invalid old price.");
    }

    result.oldPrice = body.oldPrice;
  }

  if (Object.hasOwn(body, "image")) {
    const value = text(body.image);

    let url;

    try {
      url = new URL(value);
    } catch {
      fail(400, "Use a valid HTTPS image URL.");
    }

    if (url.protocol !== "https:" || value.length > 2000) {
      fail(400, "Use a valid HTTPS image URL.");
    }

    result.image = value;
  } else if (!partial) {
    fail(400, "Product image is required.");
  }

  if (Object.hasOwn(body, "active")) {
    if (typeof body.active !== "boolean") {
      fail(400, "Active must be true or false.");
    }

    result.active = body.active;
  }

  if (partial && Object.keys(result).length === 0) {
    fail(400, "No valid product changes provided.");
  }

  return result;
}

/* Admin: list products */

app.get("/api/admin/products", protect, adminOnly, async (req, res) => {
  const products = await Product.find().sort({ createdAt: -1 }).limit(200);

  res.json({
    products: products.map(productResponse),
  });
});

/* Admin: add product */

app.post("/api/admin/products", protect, adminOnly, async (req, res) => {
  const data = productInput(req.body || {});

  const product = await Product.create(data);

  res.status(201).json({
    product: productResponse(product),
  });
});

/* Admin: edit product */

app.patch("/api/admin/products/:id", protect, adminOnly, async (req, res) => {
  if (!validId(req.params.id)) {
    fail(404, "Product not found.");
  }

  const data = productInput(req.body || {}, true);

  const product = await Product.findByIdAndUpdate(
    req.params.id,

    { $set: data },

    {
      new: true,

      runValidators: true,
    },
  );

  if (!product) {
    fail(404, "Product not found.");
  }

  res.json({
    product: productResponse(product),
  });
});

/* Admin: remove product from storefront */

app.delete("/api/admin/products/:id", protect, adminOnly, async (req, res) => {
  if (!validId(req.params.id)) {
    fail(404, "Product not found.");
  }

  const product = await Product.findByIdAndUpdate(
    req.params.id,

    {
      $set: {
        active: false,
      },
    },

    { new: true },
  );

  if (!product) {
    fail(404, "Product not found.");
  }

  res.json({
    message: "Product removed from the storefront.",
  });
});

/* Admin: list orders */

app.get("/api/admin/orders", protect, adminOnly, async (req, res) => {
  const orders = await Order.find()

    .populate("user", "name email")

    .sort({ createdAt: -1 })

    .limit(100);

  res.json({
    orders: orders.map(orderResponse),
  });
});

/* Admin: update order status */

app.patch(
  "/api/admin/orders/:id/status",

  protect,

  adminOnly,

  async (req, res) => {
    if (!validId(req.params.id)) {
      fail(404, "Order not found.");
    }

    const status = req.body?.status;

    const allowed = [
      "pending",

      "confirmed",

      "shipped",

      "delivered",

      "cancelled",
    ];

    if (!allowed.includes(status)) {
      fail(400, "Invalid order status.");
    }

    const order = await Order.findById(req.params.id);

    if (!order) {
      fail(404, "Order not found.");
    }

    const transitions = {
      pending: ["confirmed", "cancelled"],

      confirmed: ["shipped", "cancelled"],

      shipped: ["delivered"],

      delivered: [],

      cancelled: [],
    };

    if (
      order.status !== status &&
      !transitions[order.status].includes(status)
    ) {
      fail(409, "This order status change is not allowed.");
    }

    order.status = status;

    await order.save();

    res.json({
      order: orderResponse(order),
    });
  },
);

/* Unknown routes */

app.use((req, res) => {
  res.status(404).json({
    message: "API route not found.",
  });
});

/* Error handling */

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error.code === 11000) {
    return res.status(409).json({
      message: "This record already exists.",
    });
  }

  if (error.name === "ValidationError") {
    return res.status(400).json({
      message: "Please check the submitted data.",
    });
  }

  if (error instanceof SyntaxError && error.status === 400) {
    return res.status(400).json({
      message: "Invalid JSON body.",
    });
  }

  const status = error.status || 500;

  if (status >= 500) {
    console.error("Request failed:", error.name);
  }

  res.status(status).json({
    message:
      status >= 500 ? "Something went wrong. Please try again." : error.message,
  });
});

/* Connect and start */

try {
  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
  });

  console.log("MongoDB connected");

  const server = app.listen(PORT, () => {
    console.log(`NABO BEAUTY API: http://localhost:${PORT}`);
  });

  server.on("error", (error) => {
    console.error("Server startup failed:", error.code);

    process.exit(1);
  });
} catch {
  console.error(
    "Could not connect to MongoDB. Check MONGO_URI, database credentials, and Atlas network access.",
  );

  process.exit(1);
}
