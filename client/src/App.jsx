import { useEffect, useState } from "react";

import { apiRequest } from "../api";

const categories = [
  "All",
  "Eyes",
  "Lips",
  "Face",
  "Nails",
  "Skincare",
  "Fragrance",
];

const money = (value) => `${Number(value).toLocaleString("en-US")} IQD`;

const DEFAULT_FILTERS = Object.freeze({
  search: "",
  category: "All",
  sort: "featured",
  page: 1,
  pageSize: 8,
  minPrice: "",
  maxPrice: "",
  inStock: false,
});

const validId = (value) =>
  typeof value === "string" && /^[a-f\d]{24}$/i.test(value);

function read(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function readFilters() {
  const value = read("jamola-catalog-v2", {});
  if (!value || typeof value !== "object" || Array.isArray(value))
    return { ...DEFAULT_FILTERS };
  const price = (input) =>
    typeof input === "string" &&
    /^\d{1,10}$/.test(input) &&
    Number(input) <= 1000000000
      ? input
      : "";
  return {
    search: typeof value.search === "string" ? value.search.slice(0, 100) : "",
    category: categories.includes(value.category) ? value.category : "All",
    sort: ["featured", "low", "high", "name"].includes(value.sort)
      ? value.sort
      : "featured",
    page:
      Number.isInteger(value.page) && value.page > 0 && value.page <= 100000
        ? value.page
        : 1,
    pageSize: [8, 12, 24].includes(value.pageSize) ? value.pageSize : 8,
    minPrice: price(value.minPrice),
    maxPrice: price(value.maxPrice),
    inStock: value.inStock === true,
  };
}

function readSavedCart() {
  const saved = read("jamola-api-cart", []);
  if (!Array.isArray(saved)) return [];
  const unique = new Map();
  for (const item of saved) {
    if (
      validId(item?.id) &&
      Number.isInteger(item.quantity) &&
      item.quantity >= 1 &&
      item.quantity <= 10
    ) {
      unique.set(item.id, { id: item.id, quantity: item.quantity });
    }
    if (unique.size === 50) break;
  }
  return [...unique.values()];
}

function readSavedFavorites() {
  const saved = read("jamola-api-favorites", []);
  return Array.isArray(saved)
    ? [...new Set(saved.filter(validId))].slice(0, 100)
    : [];
}

function readSession() {
  try {
    return JSON.parse(sessionStorage.getItem("jamola-session")) ?? null;
  } catch {
    return null;
  }
}

function getRoute() {
  return window.location.hash.slice(1) || "/";
}

function ProductImage({ product }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [product.image]);

  return failed ? (
    <div className="jm-image-fallback">NABO</div>
  ) : (
    <img
      src={product.image}
      alt={product.name}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

function ProductCard({ product, favorite, onFavorite, onAdd }) {
  return (
    <article className="jm-card">
      <div className="jm-card-image">
        {product.badge && <span className="jm-badge">{product.badge}</span>}

        <button
          className={`jm-heart ${favorite ? "selected" : ""}`}
          onClick={() => onFavorite(product.id)}
          aria-label={favorite ? "Remove from wishlist" : "Add to wishlist"}
        >
          {favorite ? "♥" : "♡"}
        </button>

        <a href={`#/product/${product.id}`}>
          <ProductImage product={product} />
        </a>
      </div>

      <div className="jm-card-body">
        <small>{product.brand}</small>

        <a href={`#/product/${product.id}`}>
          <h3>{product.name}</h3>
        </a>

        <p className="jm-shade">{product.shade || product.category}</p>

        <div className="jm-price">
          <strong>{money(product.price)}</strong>

          {product.oldPrice > product.price && (
            <del>{money(product.oldPrice)}</del>
          )}
        </div>

        <button
          className="jm-button jm-outline jm-full"
          onClick={() => onAdd(product)}
          disabled={product.stock < 1}
        >
          {product.stock < 1 ? "Sold out" : "Add to bag"}
        </button>
      </div>
    </article>
  );
}

function AuthForm({ register, onSubmit }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    const values = Object.fromEntries(new FormData(event.currentTarget));

    setBusy(true);
    setError("");

    try {
      await onSubmit(values, register);
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="jm-auth">
      <p className="jm-eyebrow">YOUR BEAUTY SPACE</p>

      <h1>{register ? "Join NABO." : "Welcome back."}</h1>

      <p>
        {register
          ? "Create your account and discover your next favorites."
          : "Sign in to shop and follow your orders."}
      </p>

      <form className="jm-form" onSubmit={handleSubmit}>
        {register && (
          <label>
            Full name
            <input
              name="name"
              autoComplete="name"
              minLength={2}
              maxLength={80}
              required
            />
          </label>
        )}

        <label>
          Email address
          <input
            name="email"
            type="email"
            autoComplete="email"
            maxLength={254}
            required
          />
        </label>

        <label>
          Password
          <input
            name="password"
            type="password"
            autoComplete={register ? "new-password" : "current-password"}
            minLength={8}
            required
          />
        </label>

        {error && <p className="jm-error">{error}</p>}

        <button className="jm-button" disabled={busy}>
          {busy ? "Please wait..." : register ? "Create account" : "Sign in"}
        </button>
      </form>

      <p>
        {register ? "Already a member? " : "New here? "}

        <a href={register ? "#/login" : "#/register"}>
          {register ? "Sign in" : "Create account"}
        </a>
      </p>
    </section>
  );
}

function CheckoutForm({ user, busy, error, onSubmit }) {
  return (
    <form className="jm-form" onSubmit={onSubmit}>
      <h2>Delivery details</h2>

      <label>
        Full name
        <input
          name="name"
          defaultValue={user.name}
          autoComplete="name"
          minLength={2}
          maxLength={80}
          required
        />
      </label>

      <label>
        Phone number
        <input
          name="phone"
          type="tel"
          autoComplete="tel"
          placeholder="07XXXXXXXXX"
          pattern="[+0-9 ()\-]{8,20}"
          required
        />
      </label>

      <label>
        City
        <input
          name="city"
          autoComplete="address-level2"
          placeholder="Baghdad"
          minLength={2}
          maxLength={80}
          required
        />
      </label>

      <label>
        Full address
        <textarea
          name="address"
          autoComplete="street-address"
          placeholder="Area, street, building and nearest landmark"
          minLength={10}
          maxLength={300}
          rows={4}
          required
        />
      </label>

      <div className="jm-note">Payment method: cash on delivery.</div>

      {error && <p className="jm-error">{error}</p>}

      <button className="jm-button" disabled={busy}>
        {busy ? "Placing order..." : "Place order"}
      </button>
    </form>
  );
}

export default function App() {
  const [route, setRoute] = useState(getRoute);
  const [products, setProducts] = useState([]);
  const [requestLoading, setLoading] = useState(true);
  const [productError, setProductError] = useState("");
  const [reload, setReload] = useState(0);

  const [filters, setFilters] = useState(readFilters);
  const [debouncedFilters, setDebouncedFilters] = useState(filters);
  const { category, search, sort } = filters;
  const loading =
    requestLoading || (route === "/shop" && filters !== debouncedFilters);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 8,
    total: 0,
    totalPages: 0,
  });
  const [cart, setCart] = useState(readSavedCart);
  const [favorites, setFavorites] = useState(readSavedFavorites);

  function updateFilters(changes) {
    setLoading(true);
    setProductError("");
    setFilters((current) => ({ ...current, ...changes, page: 1 }));
  }

  function goToPage(value) {
    setLoading(true);
    setFilters((current) => ({ ...current, page: value }));
    document
      .getElementById("catalog-heading")
      ?.scrollIntoView({ behavior: "smooth" });
  }

  useEffect(() => {
    try {
      localStorage.setItem("jamola-catalog-v2", JSON.stringify(filters));
    } catch {
      /* storage may be unavailable */
    }
    const timer = setTimeout(() => setDebouncedFilters(filters), 350);
    return () => clearTimeout(timer);
  }, [filters]);

  const [session, setSession] = useState(readSession);
  const [authReady, setAuthReady] = useState(false);

  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [orderReload, setOrderReload] = useState(0);

  const [placingOrder, setPlacingOrder] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [lastOrder, setLastOrder] = useState(null);
  const [toast, setToast] = useState("");

  const token = session?.token;
  const user = session?.user;

  useEffect(() => {
    const handleHash = () => {
      setRoute(getRoute());
      setCheckoutError("");
      window.scrollTo({ top: 0, behavior: "instant" });
    };

    window.addEventListener("hashchange", handleHash);

    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("jamola-api-cart", JSON.stringify(cart));
    } catch {
      // The current tab can continue if storage is unavailable.
    }
  }, [cart]);

  useEffect(() => {
    try {
      localStorage.setItem("jamola-api-favorites", JSON.stringify(favorites));
    } catch {
      // The current tab can continue if storage is unavailable.
    }
  }, [favorites]);

  useEffect(() => {
    try {
      if (session) {
        sessionStorage.setItem("jamola-session", JSON.stringify(session));
      } else {
        sessionStorage.removeItem("jamola-session");
      }
    } catch {
      // Authentication still works for the current page.
    }
  }, [session]);

  useEffect(() => {
    if (!toast) return;

    const timeout = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(timeout);
  }, [toast]);

  // ID lookups keep saved carts/wishlists correct across pagination and refreshes.
  const savedIds = [
    ...new Set(
      route === "/wishlist"
        ? favorites
        : ["/cart", "/checkout"].includes(route)
          ? cart.map((item) => item.id)
          : [],
    ),
  ]
    .sort()
    .join(",");

  useEffect(() => {
    const controller = new AbortController();
    let current = true;

    async function loadProducts() {
      setLoading(true);
      setProductError("");
      try {
        let data;
        if (["/cart", "/checkout", "/wishlist"].includes(route)) {
          data = savedIds
            ? await apiRequest(
                `/products/lookup?${new URLSearchParams({ ids: savedIds })}`,
                { signal: controller.signal },
              )
            : { products: [] };
        } else if (route.startsWith("/product/")) {
          const id = route.split("/")[2];
          const detail = await apiRequest(
            `/products/${encodeURIComponent(id)}`,
            { signal: controller.signal },
          );
          const related = await apiRequest(
            `/products?${new URLSearchParams({ category: detail.product.category, limit: "5" })}`,
            { signal: controller.signal },
          );
          data = {
            products: [
              detail.product,
              ...related.products.filter(
                (item) => item.id !== detail.product.id,
              ),
            ],
          };
        } else {
          const query =
            route === "/shop"
              ? { ...debouncedFilters, limit: debouncedFilters.pageSize }
              : { page: 1, limit: 8, sort: "featured" };
          delete query.pageSize;
          data = await apiRequest(`/products?${new URLSearchParams(query)}`, {
            signal: controller.signal,
          });
        }
        if (!Array.isArray(data.products))
          throw new Error("Invalid product response.");
        if (!current) return;
        setProducts(data.products);
        if (data.pagination) setPagination(data.pagination);
      } catch (error) {
        if (current && error.name !== "AbortError")
          setProductError(error.message);
      } finally {
        if (current) setLoading(false);
      }
    }

    loadProducts();
    return () => {
      current = false;
      controller.abort();
    };
  }, [route, reload, debouncedFilters, savedIds]);

  useEffect(() => {
    const controller = new AbortController();

    setAuthReady(false);
    setOrders([]);

    if (!token) {
      setAuthReady(true);
      return () => controller.abort();
    }

    async function verifySession() {
      try {
        const data = await apiRequest("/auth/me", {
          token,
          signal: controller.signal,
        });

        setSession((current) =>
          current?.token === token ? { token, user: data.user } : current,
        );
      } catch (error) {
        if (error.name === "AbortError") return;

        if (error.status === 401) {
          setSession(null);
          setToast("Your session expired. Please sign in again.");
        } else {
          setToast(error.message);
        }
      } finally {
        if (!controller.signal.aborted) setAuthReady(true);
      }
    }

    verifySession();

    return () => controller.abort();
  }, [token]);

  useEffect(() => {
    if (route !== "/orders" || !token || !authReady) {
      return;
    }

    const controller = new AbortController();

    async function loadOrders() {
      setOrdersLoading(true);
      setOrdersError("");

      try {
        const data = await apiRequest("/orders/my", {
          token,
          signal: controller.signal,
        });

        setOrders(data.orders);
      } catch (error) {
        if (error.name === "AbortError") return;

        setOrdersError(error.message);

        if (error.status === 401) {
          setSession(null);
          setOrders([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setOrdersLoading(false);
        }
      }
    }

    loadOrders();

    return () => controller.abort();
  }, [route, token, authReady, orderReload]);

  const items = cart
    .map((item) => {
      const product = products.find((product) => product.id === item.id);

      return product ? { ...product, quantity: item.quantity } : null;
    })
    .filter(Boolean);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  const shipping = subtotal === 0 || subtotal >= 75000 ? 0 : 5000;

  const unavailableItems = cart.length - items.length;

  function addToCart(product) {
    if (product.stock < 1) return;

    const existing = cart.find((item) => item.id === product.id);

    const limit = Math.min(product.stock, 10);

    if (existing && existing.quantity >= limit) {
      setToast(`Maximum available quantity: ${limit}`);
      return;
    }

    if (!existing && cart.length >= 50) {
      setToast("Your bag can contain up to 50 different products.");
      return;
    }

    setCart((current) => {
      const found = current.find((item) => item.id === product.id);

      return found
        ? current.map((item) =>
            item.id === product.id
              ? {
                  ...item,
                  quantity: Math.min(item.quantity + 1, limit),
                }
              : item,
          )
        : [...current, { id: product.id, quantity: 1 }];
    });

    setToast("Added to your bag.");
  }

  function changeQuantity(id, amount) {
    const product = products.find((product) => product.id === id);

    const limit = Math.min(product?.stock ?? 0, 10);

    setCart((current) =>
      current
        .map((item) =>
          item.id === id
            ? {
                ...item,
                quantity: Math.max(0, Math.min(item.quantity + amount, limit)),
              }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }

  function toggleFavorite(id) {
    if (!favorites.includes(id) && favorites.length >= 100) {
      setToast("Your wishlist can contain up to 100 products.");
      return;
    }
    setFavorites((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  }

  function chooseCategory(value) {
    updateFilters({ category: value, search: "" });
    window.location.hash = "/shop";
  }

  async function authenticate(values, register) {
    const data = await apiRequest(register ? "/auth/register" : "/auth/login", {
      method: "POST",
      body: values,
    });

    setSession({ token: data.token, user: data.user });
    setOrders([]);
    setToast(register ? "Your account is ready." : "Welcome back.");

    window.location.hash = cart.length ? "/checkout" : "/account";
  }

  function logout() {
    setSession(null);
    setOrders([]);
    setLastOrder(null);
    setToast("Signed out.");
    window.location.hash = "/";
  }

  async function placeOrder(event) {
    event.preventDefault();

    if (placingOrder || !token || !items.length) return;

    setPlacingOrder(true);
    setCheckoutError("");

    const customer = Object.fromEntries(new FormData(event.currentTarget));

    try {
      const data = await apiRequest("/orders", {
        method: "POST",
        token,
        body: {
          customer,
          items: items.map((item) => ({
            productId: item.id,
            quantity: item.quantity,
          })),
        },
      });

      setLastOrder(data.order);
      setCart([]);
      setOrders([]);
      setOrderReload((value) => value + 1);
      window.location.hash = "/success";
    } catch (error) {
      setCheckoutError(error.message);

      if (error.status === 401) {
        setSession(null);
        setToast("Please sign in again.");
      }
    } finally {
      setPlacingOrder(false);
    }
  }

  function grid(list) {
    return list.length ? (
      <div className="jm-grid">
        {list.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            favorite={favorites.includes(product.id)}
            onFavorite={toggleFavorite}
            onAdd={addToCart}
          />
        ))}
      </div>
    ) : (
      <div className="jm-empty">No products found.</div>
    );
  }

  function catalogContent(list) {
    if (loading) {
      return <div className="jm-empty">Loading products...</div>;
    }

    if (productError) {
      return (
        <div className="jm-empty">
          <p className="jm-error">{productError}</p>

          <button
            className="jm-button"
            onClick={() => setReload((value) => value + 1)}
          >
            Try again
          </button>
        </div>
      );
    }

    return grid(list);
  }

  function summary(checkout = false) {
    return (
      <aside className="jm-summary">
        <h2>Order summary</h2>

        <p>
          <span>Subtotal</span>
          <strong>{money(subtotal)}</strong>
        </p>

        <p>
          <span>Delivery</span>
          <strong>{shipping ? money(shipping) : "Free"}</strong>
        </p>

        <p className="jm-total">
          <span>Total</span>
          <strong>{money(subtotal + shipping)}</strong>
        </p>

        <small>Free delivery on orders of 75,000 IQD or more.</small>

        {!checkout && (
          <a className="jm-button jm-full" href="#/checkout">
            Checkout →
          </a>
        )}
      </aside>
    );
  }

  const heroProduct =
    products.find((product) => product.catalogId === 4) || products[0];

  let page;

  if (route === "/") {
    page = (
      <>
        <section className="jm-hero">
          <div className="jm-hero-copy">
            <p className="jm-eyebrow">THE EVERYDAY BEAUTY EDIT</p>
            <h1>
              LESS ROUTINE.
              <br />
              MORE YOU.
            </h1>
            <p>
              Considered makeup, skincare and fragrance. Discover the essentials
              that make every day feel a little more yours.
            </p>

            <a className="jm-button" href="#/shop">
              Explore the collection →
            </a>
          </div>

          <div className="jm-hero-art">
            <span className="jm-hero-word">NABO</span>

            {heroProduct && (
              <a href={`#/product/${heroProduct.id}`}>
                <ProductImage product={heroProduct} />
              </a>
            )}

            <span className="jm-hero-caption">CURATED BEAUTY. EVERY DAY.</span>
          </div>
        </section>

        <div className="jm-benefits">
          <span>Carefully selected beauty</span>
          <span>Cash on delivery</span>
          <span>Free delivery from 75,000 IQD</span>
        </div>

        <section className="jm-section">
          <div className="jm-heading">
            <div>
              <p className="jm-eyebrow">FIND YOUR FAVORITES</p>
              <h2>Shop by category.</h2>
            </div>
          </div>

          <div className="jm-categories">
            {categories.slice(1).map((value, index) => (
              <button key={value} onClick={() => chooseCategory(value)}>
                <span>0{index + 1}</span>
                <strong>{value}</strong>
                <span>↗</span>
              </button>
            ))}
          </div>
        </section>

        <section className="jm-section">
          <div className="jm-heading">
            <div>
              <p className="jm-eyebrow">THE BEAUTY EDIT</p>
              <h2>Meet your next favorites.</h2>
            </div>

            <a href="#/shop">Shop all →</a>
          </div>

          {catalogContent(products.slice(0, 8))}
        </section>

        <section className="jm-banner">
          <p className="jm-eyebrow">MAKE IT PERSONAL</p>
          <h2>A scent that stays with you.</h2>
          <p>Explore our fragrance collection.</p>

          <button
            className="jm-button"
            onClick={() => chooseCategory("Fragrance")}
          >
            Discover fragrance →
          </button>
        </section>
      </>
    );
  } else if (route === "/shop") {
    page = (
      <section className="jm-section">
        <p className="jm-eyebrow">THE COLLECTION</p>
        <h1 id="catalog-heading">Your next everyday essential.</h1>

        <div className="jm-toolbar">
          <input
            aria-label="Search products"
            placeholder="Search products, brands or categories..."
            maxLength={100}
            value={search}
            onChange={(event) => updateFilters({ search: event.target.value })}
          />

          <select
            aria-label="Product category"
            value={category}
            onChange={(event) =>
              updateFilters({ category: event.target.value })
            }
          >
            {categories.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>

          <select
            aria-label="Sort products"
            value={sort}
            onChange={(event) => updateFilters({ sort: event.target.value })}
          >
            <option value="featured">Featured</option>
            <option value="low">Price: low to high</option>
            <option value="high">Price: high to low</option>
            <option value="name">Name: A–Z</option>
          </select>
        </div>

        <div className="jm-filter-row">
          <label>
            Min price (IQD)
            <input
              type="number"
              min="0"
              max="1000000000"
              step="1"
              value={filters.minPrice}
              onChange={(event) =>
                updateFilters({ minPrice: event.target.value })
              }
              placeholder="0"
            />
          </label>
          <label>
            Max price (IQD)
            <input
              type="number"
              min="0"
              max="1000000000"
              step="1"
              value={filters.maxPrice}
              onChange={(event) =>
                updateFilters({ maxPrice: event.target.value })
              }
              placeholder="Any price"
            />
          </label>
          <label>
            Products per page
            <select
              value={filters.pageSize}
              onChange={(event) =>
                updateFilters({ pageSize: Number(event.target.value) })
              }
            >
              <option value={8}>8</option>
              <option value={12}>12</option>
              <option value={24}>24</option>
            </select>
          </label>
          <label className="jm-checkbox">
            <input
              type="checkbox"
              checked={filters.inStock}
              onChange={(event) =>
                updateFilters({ inStock: event.target.checked })
              }
            />{" "}
            In stock only
          </label>
          <button
            className="jm-button jm-outline"
            onClick={() => updateFilters({ ...DEFAULT_FILTERS })}
          >
            Reset filters
          </button>
        </div>

        {!loading && !productError && (
          <p className="jm-muted" role="status">
            {pagination.total === 0
              ? "No matching products"
              : `Showing ${(pagination.page - 1) * pagination.limit + 1}–${Math.min(pagination.page * pagination.limit, pagination.total)} of ${pagination.total} products`}
          </p>
        )}

        <div aria-busy={loading}>{catalogContent(products)}</div>
        {!productError && pagination.totalPages > 1 && (
          <nav className="jm-pagination" aria-label="Product pages">
            <button
              disabled={loading || !pagination.hasPreviousPage}
              onClick={() => goToPage(pagination.page - 1)}
            >
              ← Previous
            </button>
            {Array.from(
              { length: pagination.totalPages },
              (_, index) => index + 1,
            )
              .filter(
                (number) =>
                  number === 1 ||
                  number === pagination.totalPages ||
                  Math.abs(number - pagination.page) <= 2,
              )
              .map((number, index, list) => (
                <span key={number}>
                  {index > 0 && number - list[index - 1] > 1 && (
                    <span className="jm-ellipsis">…</span>
                  )}
                  <button
                    disabled={loading}
                    aria-current={
                      number === pagination.page ? "page" : undefined
                    }
                    onClick={() => goToPage(number)}
                  >
                    {number}
                  </button>
                </span>
              ))}
            <button
              disabled={loading || !pagination.hasNextPage}
              onClick={() => goToPage(pagination.page + 1)}
            >
              Next →
            </button>
          </nav>
        )}
      </section>
    );
  } else if (route.startsWith("/product/")) {
    const id = route.split("/")[2];
    const product = products.find((product) => product.id === id);

    page =
      loading || productError ? (
        catalogContent([])
      ) : product ? (
        <section className="jm-section">
          <a href="#/shop">← Back to shop</a>

          <div className="jm-product-detail">
            <div className="jm-detail-image">
              <ProductImage product={product} />
            </div>

            <div>
              <p className="jm-eyebrow">{product.brand}</p>
              <h1>{product.name}</h1>
              <p className="jm-muted">{product.shade}</p>

              <div className="jm-price jm-detail-price">
                <strong>{money(product.price)}</strong>

                {product.oldPrice > product.price && (
                  <del>{money(product.oldPrice)}</del>
                )}
              </div>

              <p>{product.description}</p>

              <p className="jm-muted">
                {product.stock > 0
                  ? `${product.stock} available`
                  : "Currently sold out"}
              </p>

              <div className="jm-actions">
                <button
                  className="jm-button"
                  disabled={product.stock < 1}
                  onClick={() => addToCart(product)}
                >
                  Add to bag
                </button>

                <button
                  className="jm-button jm-outline"
                  onClick={() => toggleFavorite(product.id)}
                >
                  {favorites.includes(product.id) ? "♥ Saved" : "♡ Save"}
                </button>
              </div>

              <div className="jm-note">
                Cash on delivery · Free delivery from 75,000 IQD
              </div>
            </div>
          </div>

          <div className="jm-heading">
            <h2>You might also like.</h2>
          </div>

          {grid(
            products
              .filter(
                (item) =>
                  item.id !== product.id && item.category === product.category,
              )
              .slice(0, 4),
          )}
        </section>
      ) : (
        <div className="jm-empty">
          Product not found. <a href="#/shop">Back to shop</a>
        </div>
      );
  } else if (route === "/wishlist") {
    page = (
      <section className="jm-section">
        <p className="jm-eyebrow">SAVED FOR LATER</p>
        <h1>Your wishlist.</h1>

        {catalogContent(
          products.filter((product) => favorites.includes(product.id)),
        )}
      </section>
    );
  } else if (route === "/cart") {
    page = (
      <section className="jm-section">
        <p className="jm-eyebrow">YOUR BEAUTY PICKS</p>
        <h1>Shopping bag.</h1>

        {loading || productError ? (
          catalogContent([])
        ) : !cart.length ? (
          <div className="jm-empty">
            <p>Your bag is waiting for something good.</p>
            <a className="jm-button" href="#/shop">
              Explore products
            </a>
          </div>
        ) : (
          <>
            {unavailableItems > 0 && (
              <div className="jm-note">
                <p>Some products in your bag are no longer available.</p>

                <button
                  className="jm-text-button"
                  onClick={() =>
                    setCart((current) =>
                      current.filter((item) =>
                        products.some((product) => product.id === item.id),
                      ),
                    )
                  }
                >
                  Remove unavailable products
                </button>
              </div>
            )}

            <div className="jm-two-columns">
              <div>
                {items.map((item) => (
                  <article className="jm-cart-row" key={item.id}>
                    <a className="jm-cart-image" href={`#/product/${item.id}`}>
                      <ProductImage product={item} />
                    </a>

                    <div>
                      <small>{item.brand}</small>
                      <h3>{item.name}</h3>
                      <p>{money(item.price)}</p>

                      <div className="jm-quantity">
                        <button
                          aria-label="Decrease quantity"
                          onClick={() => changeQuantity(item.id, -1)}
                        >
                          −
                        </button>

                        <span>{item.quantity}</span>

                        <button
                          aria-label="Increase quantity"
                          disabled={item.quantity >= Math.min(item.stock, 10)}
                          onClick={() => changeQuantity(item.id, 1)}
                        >
                          +
                        </button>
                      </div>

                      {item.quantity > item.stock && (
                        <p className="jm-error">
                          Only {item.stock} available. Reduce the quantity.
                        </p>
                      )}
                    </div>

                    <div className="jm-cart-end">
                      <strong>{money(item.price * item.quantity)}</strong>

                      <button
                        className="jm-text-button"
                        onClick={() =>
                          setCart((current) =>
                            current.filter((value) => value.id !== item.id),
                          )
                        }
                      >
                        Remove
                      </button>
                    </div>
                  </article>
                ))}
              </div>

              {items.length > 0 && summary()}
            </div>
          </>
        )}
      </section>
    );
  } else if (route === "/checkout") {
    page = (
      <section className="jm-section">
        <p className="jm-eyebrow">ONE LAST STEP</p>
        <h1>Checkout.</h1>

        {!authReady ? (
          <div className="jm-empty">Checking your account...</div>
        ) : !user ? (
          <div className="jm-empty">
            <p>Sign in to place your order.</p>
            <a className="jm-button" href="#/login">
              Sign in
            </a>
          </div>
        ) : loading || productError ? (
          catalogContent([])
        ) : !items.length ? (
          <div className="jm-empty">
            Your bag is empty. <a href="#/shop">Shop now</a>
          </div>
        ) : unavailableItems > 0 ||
          items.some((item) => item.quantity > item.stock) ? (
          <div className="jm-empty">
            <p>
              Update unavailable products or quantities before placing your
              order.
            </p>
            <a className="jm-button" href="#/cart">
              Review bag
            </a>
          </div>
        ) : (
          <div className="jm-two-columns">
            <CheckoutForm
              user={user}
              busy={placingOrder}
              error={checkoutError}
              onSubmit={placeOrder}
            />
            {summary(true)}
          </div>
        )}
      </section>
    );
  } else if (route === "/login" || route === "/register") {
    page = (
      <AuthForm
        key={route}
        register={route === "/register"}
        onSubmit={authenticate}
      />
    );
  } else if (route === "/account") {
    page = (
      <section className="jm-section">
        <p className="jm-eyebrow">YOUR SPACE</p>
        <h1>My account.</h1>

        {!authReady ? (
          <p>Checking your account...</p>
        ) : user ? (
          <div className="jm-account">
            <h2>Hello, {user.name}.</h2>
            <p>{user.email}</p>

            <div className="jm-actions">
              <a className="jm-button" href="#/orders">
                My orders
              </a>

              <button className="jm-button jm-outline" onClick={logout}>
                Sign out
              </button>
            </div>
          </div>
        ) : (
          <a className="jm-button" href="#/login">
            Sign in
          </a>
        )}
      </section>
    );
  } else if (route === "/orders") {
    page = (
      <section className="jm-section">
        <p className="jm-eyebrow">FROM OUR STORE TO YOUR DOOR</p>
        <h1>Your orders.</h1>

        {!authReady ? (
          <p>Checking your account...</p>
        ) : !user ? (
          <a className="jm-button" href="#/login">
            Sign in to view orders
          </a>
        ) : ordersLoading ? (
          <div className="jm-empty">Loading your orders...</div>
        ) : ordersError ? (
          <div className="jm-empty">
            <p className="jm-error">{ordersError}</p>
            <button
              className="jm-button"
              onClick={() => setOrderReload((value) => value + 1)}
            >
              Try again
            </button>
          </div>
        ) : !orders.length ? (
          <div className="jm-empty">
            <p>No orders yet.</p>
            <a className="jm-button" href="#/shop">
              Start shopping
            </a>
          </div>
        ) : (
          orders.map((order) => (
            <article className="jm-order" key={order.id}>
              <div className="jm-heading">
                <div>
                  <strong>Order #{order.id.slice(-8).toUpperCase()}</strong>

                  <p className="jm-muted">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </p>
                </div>

                <span className="jm-status">{order.status}</span>
              </div>

              {order.items.map((item, index) => (
                <div className="jm-order-item" key={`${order.id}-${index}`}>
                  <span>
                    {item.name} × {item.quantity}
                  </span>
                  <strong>{money(item.price * item.quantity)}</strong>
                </div>
              ))}

              <div className="jm-order-item">
                <span>Delivery</span>
                <span>{money(order.shipping)}</span>
              </div>

              <div className="jm-order-item jm-total">
                <strong>Total</strong>
                <strong>{money(order.total)}</strong>
              </div>
            </article>
          ))
        )}
      </section>
    );
  } else if (route === "/success") {
    page = (
      <section className="jm-empty jm-success">
        <span className="jm-success-icon">✓</span>
        <h1>{lastOrder ? "Your order is in." : "Thank you."}</h1>

        {lastOrder && (
          <>
            <p>Order #{lastOrder.id.slice(-8).toUpperCase()}</p>
            <p>Total: {money(lastOrder.total)}</p>
            <p>Payment: cash on delivery.</p>
          </>
        )}

        <div className="jm-actions">
          <a className="jm-button" href="#/orders">
            View my orders
          </a>

          <a className="jm-button jm-outline" href="#/shop">
            Continue shopping
          </a>
        </div>
      </section>
    );
  } else if (route === "/about") {
    page = (
      <section className="jm-about">
        <p className="jm-eyebrow">HELLO, WE ARE NABO</p>
        <h1>Beauty should feel like you.</h1>
        <p>
          A space to discover makeup, skincare and fragrance. From everyday
          essentials to a little something special, explore your own way of
          doing beauty.
        </p>

        <a className="jm-button" href="#/shop">
          Discover the collection
        </a>
      </section>
    );
  } else {
    page = (
      <div className="jm-empty">
        <h1>Page not found.</h1>
        <a className="jm-button" href="#/">
          Back home
        </a>
      </div>
    );
  }

  return (
    <div className="jm-app">
      <style>{styles}</style>
      <div className="jm-announcement">
        THE NABO EDIT · FREE DELIVERY FROM 75,000 IQD
      </div>

      <header className="jm-header">
        <a className="jm-logo" href="#/">
          NABO<span>BEAUTY</span>
        </a>

        <nav aria-label="Main navigation">
          <a href="#/shop">Shop all</a>

          <button onClick={() => chooseCategory("Skincare")}>Skincare</button>

          <button onClick={() => chooseCategory("Fragrance")}>Fragrance</button>

          <a href="#/about">Our story</a>
        </nav>

        <div className="jm-header-actions">
          <a href="#/wishlist" aria-label="Wishlist">
            ♡ <span>{favorites.length}</span>
          </a>

          <a href={user ? "#/account" : "#/login"}>
            {user ? "Account" : "Sign in"}
          </a>

          <a className="jm-bag-link" href="#/cart">
            Bag <span>{cartCount}</span>
          </a>
        </div>
      </header>

      <main>{page}</main>

      <footer className="jm-footer">
        <div>
          <a className="jm-logo" href="#/">
            NABO<span>BEAUTY</span>
          </a>

          <p>Your everyday beauty destination.</p>
        </div>

        <div>
          <strong>Explore</strong>
          <a href="#/shop">Shop all</a>
          <a href="#/wishlist">Wishlist</a>
          <a href="#/about">Our story</a>
        </div>

        <div>
          <strong>Your account</strong>
          <a href="#/account">My account</a>
          <a href="#/orders">My orders</a>
          <a href="#/cart">Shopping bag</a>
        </div>

        <p className="jm-copyright">© {new Date().getFullYear()} NABO BEAUTY</p>
      </footer>

      {toast && (
        <div className="jm-toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

const styles = `.jm-app {
  --pink: #b77958;
  --ink: #142d3d;
  color: var(--ink);
  background: #fffdf8;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 15px;
  line-height: 1.6;
  text-align: left;
  min-height: 100vh;
}
body {
  margin: 0;
}
#root {
  width: 100%;
  max-width: none;
  margin: 0;
  padding: 0;
}
.jm-app *,
.jm-app *::before,
.jm-app *::after {
  box-sizing: border-box;
}
.jm-app a {
  color: inherit;
  text-decoration: none;
}
.jm-app button,
.jm-app input,
.jm-app select,
.jm-app textarea {
  font: inherit;
}
.jm-app button,
.jm-app a {
  -webkit-tap-highlight-color: transparent;
}
.jm-app button {
  cursor: pointer;
}
.jm-app button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.jm-app img {
  display: block;
  max-width: 100%;
}
.jm-app h1,
.jm-app h2,
.jm-app h3,
.jm-app p {
  margin-top: 0;
}
.jm-app h1 {
  font-size: clamp(36px, 5vw, 64px);
  letter-spacing: -2px;
  line-height: 1.08;
  margin-bottom: 28px;
}
.jm-app h2 {
  font-size: clamp(25px, 3vw, 38px);
  line-height: 1.15;
  letter-spacing: -1px;
}
.jm-announcement {
  padding: 9px 16px;
  text-align: center;
  background: var(--ink);
  color: white;
  font-size: 10px;
  letter-spacing: 1.8px;
}
.jm-header {
  min-height: 90px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 28px;
  padding: 20px 5%;
  border-bottom: 1px solid #eee;
}
.jm-logo {
  display: inline-flex;
  flex-direction: column;
  font-size: 29px;
  font-weight: 900;
  letter-spacing: -1.7px;
  line-height: 1;
}
.jm-logo span {
  font-size: 9px;
  letter-spacing: 6px;
  margin-top: 7px;
  padding-left: 3px;
}
.jm-header nav,
.jm-header-actions {
  display: flex;
  align-items: center;
  gap: 24px;
  font-size: 13px;
}
.jm-header nav button {
  background: none;
  border: 0;
  padding: 0;
  color: inherit;
}
.jm-header a:hover,
.jm-footer a:hover {
  opacity: 0.65;
}
.jm-bag-link span {
  display: inline-grid;
  place-items: center;
  background: var(--ink);
  color: white;
  border-radius: 50%;
  min-width: 23px;
  height: 23px;
  margin-left: 5px;
  font-size: 11px;
}
.jm-hero {
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 560px;
}
.jm-hero-copy {
  padding: 80px 10%;
  background: #eeebe3;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
}
.jm-eyebrow {
  font-size: 10px;
  letter-spacing: 2.5px;
  font-weight: 700;
  margin-bottom: 20px;
}
.jm-hero h1 {
  font-size: clamp(48px, 6.4vw, 100px);
  font-weight: 900;
  line-height: 0.95;
  letter-spacing: -5px;
}
.jm-hero-copy > p:not(.jm-eyebrow) {
  color: #646464;
  max-width: 350px;
  margin-bottom: 30px;
}
.jm-hero-art {
  position: relative;
  overflow: hidden;
  background: #cbd5d0;
  display: grid;
  place-items: center;
  min-height: 430px;
}
.jm-hero-art > a {
  z-index: 1;
  width: 75%;
}
.jm-hero-art img {
  height: 420px;
  width: 100%;
  object-fit: contain;
  mix-blend-mode: multiply;
  transform: rotate(-12deg);
  filter: drop-shadow(16px 20px 12px #a7567040);
}
.jm-hero-word {
  position: absolute;
  color: #fffdf85c;
  font-size: clamp(90px, 12vw, 190px);
  font-weight: 900;
  white-space: nowrap;
  letter-spacing: -10px;
  transform: rotate(-90deg);
}
.jm-hero-caption {
  position: absolute;
  bottom: 22px;
  font-size: 9px;
  font-weight: bold;
  letter-spacing: 2px;
}
.jm-button {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  padding: 14px 23px;
  background: var(--ink);
  color: white !important;
  border: 1px solid var(--ink);
  border-radius: 0;
  font-size: 12px;
  font-weight: bold;
  min-height: 47px;
}
.jm-button:hover {
  background: #353535;
}
.jm-outline {
  background: transparent;
  color: var(--ink) !important;
}
.jm-outline:hover {
  background: #f3f3f3;
}
.jm-full {
  width: 100%;
}
.jm-benefits {
  display: flex;
  justify-content: space-around;
  gap: 20px;
  padding: 20px 5%;
  border-bottom: 1px solid #e8e8e8;
  font-size: 11px;
}
.jm-section {
  padding: 65px 5%;
}
.jm-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 28px;
}
.jm-heading h2 {
  margin-bottom: 0;
}
.jm-heading .jm-eyebrow {
  margin-bottom: 12px;
}
.jm-heading > a {
  font-size: 12px;
  border-bottom: 1px solid;
  white-space: nowrap;
}
.jm-categories {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 12px;
}
.jm-categories button {
  background: #f6f3ef;
  border: 0;
  padding: 22px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: var(--ink);
}
.jm-categories button:nth-child(even) {
  background: #e8ddd0;
}
.jm-categories button span {
  font-size: 10px;
}
.jm-categories button strong {
  font-size: 13px;
}
.jm-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 35px 22px;
}
.jm-card {
  min-width: 0;
}
.jm-card-image {
  position: relative;
  background: #eeece6;
  aspect-ratio: 1 / 1.12;
  overflow: hidden;
}
.jm-card-image > a {
  display: block;
  height: 100%;
}
.jm-card-image img {
  width: 100%;
  height: 100%;
  padding: 25px;
  object-fit: contain;
  mix-blend-mode: multiply;
  transition: transform 0.25s ease;
}
.jm-card-image:hover img {
  transform: scale(1.07);
}
.jm-heart {
  position: absolute;
  right: 12px;
  top: 12px;
  z-index: 2;
  border: 0;
  background: white;
  color: #222;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  font-size: 24px;
  display: grid;
  place-items: center;
  padding: 0;
}
.jm-heart.selected {
  color: #a65d3f;
}
.jm-badge {
  position: absolute;
  left: 12px;
  top: 14px;
  z-index: 2;
  background: white;
  padding: 4px 8px;
  font-size: 8px;
  text-transform: uppercase;
  letter-spacing: 1px;
}
.jm-card-body {
  padding: 17px 0 0;
}
.jm-card-body small {
  font-size: 9px;
  color: #777;
  letter-spacing: 1.3px;
}
.jm-card h3 {
  font-size: 15px;
  line-height: 1.4;
  margin: 7px 0;
  min-height: 42px;
}
.jm-shade {
  color: #888;
  font-size: 11px;
}
.jm-price {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin: 14px 0 18px;
  font-size: 13px;
}
.jm-price del {
  color: #999;
  font-size: 11px;
}
.jm-card .jm-button {
  min-height: 40px;
  padding: 9px;
}
.jm-banner {
  margin: 20px 5% 70px;
  padding: 60px 30px;
  background: #dce3dd;
  text-align: center;
}
.jm-banner h2 {
  font-size: clamp(28px, 4vw, 50px);
}
.jm-banner > p:not(.jm-eyebrow) {
  color: #65515a;
}
.jm-toolbar {
  display: flex;
  gap: 12px;
  margin: 30px 0 18px;
}
.jm-toolbar input {
  flex: 1;
  min-width: 0;
}
.jm-toolbar input,
.jm-toolbar select,
.jm-form input,
.jm-form textarea {
  padding: 13px 14px;
  border: 1px solid #ddd;
  border-radius: 0;
  background: white;
  color: var(--ink);
}
.jm-muted {
  color: #777;
  font-size: 13px;
}
.jm-empty {
  text-align: center;
  padding: 90px 20px;
}
.jm-empty > a:not(.jm-button) {
  text-decoration: underline;
}
.jm-error {
  color: #b4233a;
  font-size: 13px;
}
.jm-image-fallback {
  height: 100%;
  min-height: 150px;
  display: grid;
  place-items: center;
  color: #aaa;
  font-size: 22px;
  letter-spacing: 5px;
}
.jm-product-detail {
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: center;
  gap: 65px;
  margin: 30px 0 80px;
}
.jm-detail-image {
  background: #eeece6;
}
.jm-detail-image img {
  width: 100%;
  height: 540px;
  object-fit: contain;
  padding: 35px;
  mix-blend-mode: multiply;
}
.jm-detail-price {
  font-size: 25px;
}
.jm-detail-price del {
  font-size: 16px;
}
.jm-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin: 25px 0;
}
.jm-note {
  background: #f7f4f1;
  padding: 18px;
  margin: 25px 0;
  font-size: 12px;
}
.jm-note p {
  margin-bottom: 8px;
}
.jm-two-columns {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 55px;
  align-items: start;
}
.jm-cart-row {
  display: grid;
  grid-template-columns: 105px 1fr auto;
  gap: 22px;
  padding: 23px 0;
  border-bottom: 1px solid #eee;
}
.jm-cart-image {
  background: #eeece6;
}
.jm-cart-image img {
  width: 105px;
  height: 130px;
  object-fit: contain;
  padding: 10px;
}
.jm-cart-row small {
  font-size: 9px;
  color: #888;
}
.jm-cart-row h3 {
  font-size: 15px;
  margin: 5px 0;
}
.jm-cart-row p {
  font-size: 12px;
}
.jm-quantity {
  display: inline-flex;
  align-items: center;
  border: 1px solid #ddd;
}
.jm-quantity button {
  border: 0;
  background: white;
  color: #222;
  width: 30px;
  height: 30px;
}
.jm-quantity span {
  text-align: center;
  min-width: 26px;
  font-size: 12px;
}
.jm-cart-end {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: flex-end;
  font-size: 12px;
}
.jm-text-button {
  border: 0;
  padding: 0;
  background: transparent;
  color: #777;
  font-size: 11px;
  text-decoration: underline;
}
.jm-summary {
  padding: 28px;
  background: #eeebe3;
}
.jm-summary h2 {
  font-size: 23px;
}
.jm-summary p {
  display: flex;
  justify-content: space-between;
  gap: 15px;
  font-size: 13px;
}
.jm-total {
  border-top: 1px solid #ddd;
  padding-top: 18px;
  margin-top: 20px;
}
.jm-summary small {
  display: block;
  color: #777;
  font-size: 10px;
  margin: 20px 0;
}
.jm-form {
  display: grid;
  gap: 18px;
}
.jm-form label {
  display: grid;
  gap: 7px;
  font-size: 12px;
  font-weight: bold;
}
.jm-form textarea {
  resize: vertical;
}
.jm-form .jm-note {
  margin: 0;
}
.jm-auth {
  width: min(460px, 90%);
  margin: 75px auto;
}
.jm-auth h1 {
  font-size: 45px;
}
.jm-auth > p:not(.jm-eyebrow) {
  color: #777;
  font-size: 13px;
}
.jm-auth .jm-form {
  margin: 30px 0;
}
.jm-auth > p a {
  color: #222;
  text-decoration: underline;
}
.jm-account {
  background: #eeebe3;
  padding: 35px;
}
.jm-order {
  border: 1px solid #e4e4e4;
  padding: 28px;
  margin-bottom: 22px;
}
.jm-order .jm-heading {
  margin-bottom: 20px;
}
.jm-order .jm-muted {
  margin: 5px 0 0;
}
.jm-order-item {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  padding: 9px 0;
  font-size: 13px;
}
.jm-status {
  background: #dce3dd;
  padding: 5px 13px;
  font-size: 11px;
  text-transform: capitalize;
}
.jm-success .jm-actions {
  justify-content: center;
}
.jm-success-icon {
  display: inline-grid;
  place-items: center;
  background: #dce3dd;
  border-radius: 50%;
  width: 65px;
  height: 65px;
  font-size: 30px;
  margin-bottom: 25px;
}
.jm-about {
  max-width: 850px;
  margin: auto;
  padding: 100px 5%;
  text-align: center;
}
.jm-about > p:not(.jm-eyebrow) {
  color: #777;
  margin: 30px 0;
}
.jm-footer {
  background: #142d3d;
  color: white;
  padding: 55px 5% 25px;
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: 35px;
}
.jm-footer > div {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.jm-footer .jm-logo {
  align-self: flex-start;
}
.jm-footer p,
.jm-footer div > a:not(.jm-logo) {
  font-size: 12px;
  color: #aaa;
}
.jm-footer strong {
  font-size: 13px;
}
.jm-copyright {
  grid-column: 1 / -1;
  border-top: 1px solid #333;
  padding-top: 20px;
  margin: 10px 0 0;
  font-size: 10px !important;
}
.jm-toast {
  position: fixed;
  bottom: 25px;
  left: 50%;
  transform: translateX(-50%);
  background: #142d3d;
  color: white;
  padding: 15px 24px;
  max-width: 90vw;
  box-shadow: 0 5px 30px #0003;
  font-size: 13px;
  z-index: 100;
  text-align: center;
}
@media (max-width: 1000px) {
  .jm-header {
    flex-wrap: wrap;
    gap: 20px;
  }
  .jm-header nav {
    order: 3;
    width: 100%;
    justify-content: center;
  }
  .jm-categories {
    grid-template-columns: repeat(3, 1fr);
  }
  .jm-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .jm-two-columns {
    gap: 25px;
    grid-template-columns: 1fr 300px;
  }
  .jm-product-detail {
    gap: 30px;
  }
}
@media (max-width: 700px) {
  .jm-announcement {
    font-size: 8px;
    letter-spacing: 1px;
  }
  .jm-header {
    padding: 20px 5%;
  }
  .jm-logo {
    font-size: 25px;
  }
  .jm-header-actions {
    gap: 14px;
    font-size: 11px;
  }
  .jm-header nav {
    gap: 20px;
    font-size: 11px;
  }
  .jm-hero {
    grid-template-columns: 1fr;
  }
  .jm-hero-copy {
    padding: 50px 7%;
  }
  .jm-hero h1 {
    font-size: 66px;
    letter-spacing: -3px;
  }
  .jm-hero-art {
    min-height: 330px;
  }
  .jm-hero-art img {
    height: 300px;
  }
  .jm-hero-word {
    transform: none;
    font-size: 100px;
  }
  .jm-benefits {
    flex-wrap: wrap;
    gap: 8px 20px;
    font-size: 9px;
  }
  .jm-section {
    padding: 40px 5%;
  }
  .jm-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 25px 12px;
  }
  .jm-card-image img {
    padding: 15px;
  }
  .jm-card h3 {
    font-size: 13px;
    min-height: 37px;
  }
  .jm-card-body small {
    font-size: 8px;
  }
  .jm-card .jm-price {
    font-size: 11px;
    gap: 6px;
  }
  .jm-card .jm-price del {
    font-size: 9px;
  }
  .jm-badge {
    font-size: 7px;
    left: 7px;
    top: 9px;
    padding: 3px 5px;
  }
  .jm-heart {
    right: 7px;
    top: 7px;
    width: 27px;
    height: 27px;
    font-size: 20px;
  }
  .jm-categories button {
    padding: 16px 10px;
    gap: 5px;
  }
  .jm-categories button strong {
    font-size: 11px;
  }
  .jm-categories button span:first-child {
    display: none;
  }
  .jm-toolbar {
    flex-wrap: wrap;
  }
  .jm-toolbar input {
    flex-basis: 100%;
  }
  .jm-toolbar select {
    flex: 1;
    min-width: 0;
    font-size: 12px;
  }
  .jm-two-columns,
  .jm-product-detail {
    grid-template-columns: 1fr;
  }
  .jm-detail-image img {
    height: 350px;
  }
  .jm-product-detail {
    margin-bottom: 50px;
  }
  .jm-cart-row {
    grid-template-columns: 75px 1fr;
    gap: 15px;
  }
  .jm-cart-image img {
    width: 75px;
    height: 110px;
  }
  .jm-cart-end {
    grid-column: 2;
    flex-direction: row;
  }
  .jm-footer {
    grid-template-columns: 1fr 1fr;
  }
  .jm-footer > div:first-child {
    grid-column: 1 / -1;
  }
  .jm-order {
    padding: 18px;
  }
}

/* Backend-powered catalog controls */
.jm-filter-row {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 16px;
  margin: 16px 0 24px;
  padding: 20px;
  background: #eeebe3;
}
.jm-filter-row label {
  display: grid;
  gap: 6px;
  font-size: 12px;
}
.jm-filter-row input:not([type="checkbox"]),
.jm-filter-row select {
  width: 150px;
  padding: 10px;
  background: white;
  border: 1px solid #ddd;
}
.jm-filter-row .jm-checkbox {
  display: flex;
  align-items: center;
  min-height: 42px;
}
.jm-pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
  gap: 7px;
  margin: 36px 0 10px;
}
.jm-pagination button {
  min-width: 40px;
  min-height: 42px;
  padding: 8px 12px;
  border: 1px solid #ddd;
  background: white;
}
.jm-pagination button[aria-current="page"] {
  background: #142d3d;
  color: white;
  border-color: #142d3d;
}
.jm-ellipsis {
  padding: 0 8px;
}
@media (max-width: 700px) {
  .jm-filter-row {
    gap: 12px;
    padding: 16px;
  }
  .jm-filter-row label:not(.jm-checkbox) {
    flex: 1 1 120px;
  }
  .jm-filter-row input:not([type="checkbox"]),
  .jm-filter-row select {
    width: 100%;
  }
}

/* NABO: editorial navy, ivory and copper */
.jm-app { --ink: #142d3d; --pink: #b77958; background: #faf8f3; font-family: "DM Sans", Arial, sans-serif; }
.jm-app h1, .jm-app h2 { font-family: Georgia, "Times New Roman", serif; font-weight: 400; letter-spacing: -1.6px; }
.jm-announcement { background: #142d3d; letter-spacing: 2px; }
.jm-header { background: #faf8f3; padding: 23px 5%; border-color: #dedfd7; }
.jm-logo { font-family: Georgia, "Times New Roman", serif; letter-spacing: 4px; font-weight: 400; font-size: 35px; }
.jm-logo span { font-family: Arial, sans-serif; letter-spacing: 6px; font-size: 8px; }
.jm-header nav a, .jm-header nav button { text-transform: uppercase; letter-spacing: 1px; font-size: 10px; }
.jm-hero { margin: 24px 3% 0; min-height: 570px; border: 1px solid #d7d9d0; }
.jm-hero-copy { background: #eeebe3; padding: 65px 11%; }
.jm-hero h1 { font-family: Georgia, "Times New Roman", serif; font-size: clamp(48px, 6vw, 88px); font-weight: 400; line-height: 1.03; letter-spacing: -3px; }
.jm-hero-art { background: #cbd5d0; }
.jm-hero-word { transform: none; bottom: 30px; font-family: Georgia, serif; font-weight: 400; letter-spacing: 15px; font-size: clamp(75px, 11vw, 165px); }
.jm-hero-art img { transform: rotate(-8deg); padding-bottom: 35px; }
.jm-hero-caption { color: #142d3d; }
.jm-button { background: #142d3d; border-color: #142d3d; letter-spacing: 1px; font-size: 10px; }
.jm-button:hover { background: #254759; }
.jm-outline { background: transparent; }
.jm-outline:hover { background: #e4e8e0; }
.jm-card-image { background: #eeece6; border: 1px solid #e1e0d7; border-radius: 90px 90px 0 0; }
.jm-card h3 { font-weight: 500; }
.jm-card-body small { color: #935837; }
.jm-card .jm-button { border-color: #c5cdc7; }
.jm-heart { background: #faf8f3; color: #142d3d; }
.jm-badge { background: #faf8f3; color: #142d3d; }
.jm-categories button { border-bottom: 1px solid #bfc8bd; background: #eeebe3; }
.jm-categories button:nth-child(even) { background: #e0e6df; }
.jm-banner { background: #142d3d; color: #faf8f3; padding: 65px 25px; }
.jm-banner > p:not(.jm-eyebrow) { color: #cbd5d0; }
.jm-banner .jm-button { background: #bd8764; border-color: #bd8764; }
.jm-footer { background: #142d3d; }
.jm-footer p, .jm-footer div > a:not(.jm-logo) { color: #c2ccc5; }
.jm-pagination button[aria-current=page] { background: #142d3d; border-color: #142d3d; }
.jm-summary, .jm-account, .jm-filter-row { background: #eeebe3; border: 1px solid #dedfd7; }
.jm-form input, .jm-form textarea, .jm-toolbar input, .jm-toolbar select { background: #fffdf8; }
.jm-about { max-width: 800px; }
@media (max-width: 700px) { .jm-hero { margin: 12px 3% 0; } .jm-hero-copy { padding: 45px 8%; } .jm-hero h1 { font-size: 57px; letter-spacing: -2px; } .jm-hero-art { min-height: 330px; } .jm-hero-word { font-size: 86px; bottom: 20px; } .jm-logo { font-size: 30px; } .jm-card-image { border-radius: 60px 60px 0 0; } }
`;
