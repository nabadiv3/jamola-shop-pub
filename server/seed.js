import "dotenv/config";
import mongoose from "mongoose";

import PRODUCTS from "../client/src/products.js";
import { Product, User } from "./models.js";

if (!process.env.MONGO_URI || process.env.MONGO_URI.includes("PUT_YOUR")) {
  throw new Error("Add MONGO_URI to .env first.");
}

try {
  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
  });

  let inserted = 0;

  for (const product of PRODUCTS) {
    const { id, ...data } = product;

    const result = await Product.updateOne(
      { catalogId: id },
      {
        $setOnInsert: {
          ...data,
          catalogId: id,
          stock: 30,
          active: true,
        },
      },
      { upsert: true },
    );

    inserted += result.upsertedCount;
  }

  console.log(`Products added: ${inserted}`);
  console.log(`Total products: ${await Product.countDocuments()}`);

  const adminEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();

  if (adminEmail) {
    const result = await User.updateOne(
      { email: adminEmail },
      { $set: { role: "admin" } },
    );

    console.log(
      result.matchedCount
        ? "Admin role assigned."
        : "Admin account not found yet. Register it, then run npm run seed again.",
    );
  }
} catch (error) {
  // Show the error type without printing the connection string.
  console.error("Setup failed:", error.name);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
