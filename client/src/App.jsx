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

function readStorage(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
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
    <div className="jm-image-fallback">JAMOLA</div>
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

      <h1>{register ? "Join JAMOLA." : "Welcome back."}</h1>

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
  const [loading, setLoading] = useState(true);
  const [productError, setProductError] = useState("");
  const [reload, setReload] = useState(0);

  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("featured");

  const [cart, setCart] = useState(() => {
    const saved = readStorage("jamola-api-cart", []);
    return Array.isArray(saved)
      ? saved.filter(
          (item) =>
            typeof item?.id === "string" &&
            Number.isInteger(item.quantity) &&
            item.quantity >= 1 &&
            item.quantity <= 10,
        )
      : [];
  });

  const [favorites, setFavorites] = useState(() => {
    const saved = readStorage("jamola-api-favorites", []);
    return Array.isArray(saved)
      ? saved.filter((id) => typeof id === "string")
      : [];
  });

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

  useEffect(() => {
    const controller = new AbortController();

    async function loadProducts() {
      setLoading(true);
      setProductError("");

      try {
        const data = await apiRequest("/products", {
          signal: controller.signal,
        });

        if (!Array.isArray(data.products)) {
          throw new Error("Invalid product response.");
        }

        setProducts(data.products);
      } catch (error) {
        if (error.name !== "AbortError") {
          setProductError(error.message);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadProducts();

    return () => controller.abort();
  }, [reload]);

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
    setFavorites((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  }

  function chooseCategory(value) {
    setCategory(value);
    setSearch("");
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

  const filteredProducts = products
    .filter(
      (product) =>
        (category === "All" || product.category === category) &&
        `${product.name} ${product.brand} ${product.category}`
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
    )
    .sort((a, b) => {
      if (sort === "low") return a.price - b.price;
      if (sort === "high") return b.price - a.price;
      if (sort === "name") return a.name.localeCompare(b.name);
      return (a.catalogId ?? 0) - (b.catalogId ?? 0);
    });

  const heroProduct =
    products.find((product) => product.catalogId === 4) || products[0];

  let page;

  if (route === "/") {
    page = (
      <>
        <section className="jm-hero">
          <div className="jm-hero-copy">
            <p className="jm-eyebrow">BEAUTY, YOUR WAY</p>
            <h1>
              YOUR LOOK.
              <br />
              YOUR RULES.
            </h1>
            <p>
              Discover makeup, skincare and fragrance. Find the little things
              that feel like you.
            </p>

            <a className="jm-button" href="#/shop">
              Explore the collection →
            </a>
          </div>

          <div className="jm-hero-art">
            <span className="jm-hero-word">BE YOU</span>

            {heroProduct && (
              <a href={`#/product/${heroProduct.id}`}>
                <ProductImage product={heroProduct} />
              </a>
            )}

            <span className="jm-hero-caption">
              A LITTLE COLOR. A LOT OF CONFIDENCE.
            </span>
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
        <h1>Good beauty. Great mood.</h1>

        <div className="jm-toolbar">
          <input
            aria-label="Search products"
            placeholder="Search products or brands..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <select
            aria-label="Product category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            {categories.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>

          <select
            aria-label="Sort products"
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          >
            <option value="featured">Featured</option>
            <option value="low">Price: low to high</option>
            <option value="high">Price: high to low</option>
            <option value="name">Name: A–Z</option>
          </select>
        </div>

        {!loading && !productError && (
          <p className="jm-muted">{filteredProducts.length} products</p>
        )}

        {catalogContent(filteredProducts)}
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
        <p className="jm-eyebrow">HELLO, WE ARE JAMOLA</p>
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
        A LITTLE BEAUTY, EVERY DAY · FREE DELIVERY FROM 75,000 IQD
      </div>

      <header className="jm-header">
        <a className="jm-logo" href="#/">
          JAMOLA<span>SHOP</span>
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
            JAMOLA<span>SHOP</span>
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

        <p className="jm-copyright">© {new Date().getFullYear()} JAMOLA SHOP</p>
      </footer>

      {toast && (
        <div className="jm-toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

const styles = `
.jm-app {
  --pink: #f5bfd1;
  --ink: #171717;
  color: var(--ink);
  background: #fff;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 15px;
  line-height: 1.6;
  text-align: left;
  min-height: 100vh;
}
body { margin: 0; }
#root { width: 100%; max-width: none; margin: 0; padding: 0; }
.jm-app *, .jm-app *::before, .jm-app *::after {
  box-sizing: border-box;
}
.jm-app a { color: inherit; text-decoration: none; }
.jm-app button, .jm-app input, .jm-app select,
.jm-app textarea { font: inherit; }
.jm-app button, .jm-app a { -webkit-tap-highlight-color: transparent; }
.jm-app button { cursor: pointer; }
.jm-app button:disabled { opacity: .45; cursor: not-allowed; }
.jm-app img { display: block; max-width: 100%; }
.jm-app h1, .jm-app h2, .jm-app h3,
.jm-app p { margin-top: 0; }
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
.jm-header nav, .jm-header-actions {
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
.jm-header a:hover, .jm-footer a:hover {
  opacity: .65;
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
  background: #f7f5f1;
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
  line-height: .95;
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
  background: #edb4c8;
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
  color: #ffffff65;
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
.jm-button:hover { background: #353535; }
.jm-outline {
  background: transparent;
  color: var(--ink) !important;
}
.jm-outline:hover { background: #f3f3f3; }
.jm-full { width: 100%; }
.jm-benefits {
  display: flex;
  justify-content: space-around;
  gap: 20px;
  padding: 20px 5%;
  border-bottom: 1px solid #e8e8e8;
  font-size: 11px;
}
.jm-section { padding: 65px 5%; }
.jm-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 28px;
}
.jm-heading h2 { margin-bottom: 0; }
.jm-heading .jm-eyebrow { margin-bottom: 12px; }
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
.jm-categories button:nth-child(even) { background: #f7e4eb; }
.jm-categories button span { font-size: 10px; }
.jm-categories button strong { font-size: 13px; }
.jm-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 35px 22px;
}
.jm-card { min-width: 0; }
.jm-card-image {
  position: relative;
  background: #f6f5f3;
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
  transition: transform .25s ease;
}
.jm-card-image:hover img { transform: scale(1.07); }
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
.jm-heart.selected { color: #b83263; }
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
.jm-card-body { padding: 17px 0 0; }
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
.jm-shade { color: #888; font-size: 11px; }
.jm-price {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin: 14px 0 18px;
  font-size: 13px;
}
.jm-price del { color: #999; font-size: 11px; }
.jm-card .jm-button { min-height: 40px; padding: 9px; }
.jm-banner {
  margin: 20px 5% 70px;
  padding: 60px 30px;
  background: #f2dce5;
  text-align: center;
}
.jm-banner h2 { font-size: clamp(28px, 4vw, 50px); }
.jm-banner > p:not(.jm-eyebrow) { color: #65515a; }
.jm-toolbar {
  display: flex;
  gap: 12px;
  margin: 30px 0 18px;
}
.jm-toolbar input { flex: 1; min-width: 0; }
.jm-toolbar input, .jm-toolbar select,
.jm-form input, .jm-form textarea {
  padding: 13px 14px;
  border: 1px solid #ddd;
  border-radius: 0;
  background: white;
  color: var(--ink);
}
.jm-muted { color: #777; font-size: 13px; }
.jm-empty {
  text-align: center;
  padding: 90px 20px;
}
.jm-empty > a:not(.jm-button) { text-decoration: underline; }
.jm-error { color: #b4233a; font-size: 13px; }
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
.jm-detail-image { background: #f6f5f3; }
.jm-detail-image img {
  width: 100%;
  height: 540px;
  object-fit: contain;
  padding: 35px;
  mix-blend-mode: multiply;
}
.jm-detail-price { font-size: 25px; }
.jm-detail-price del { font-size: 16px; }
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
.jm-note p { margin-bottom: 8px; }
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
.jm-cart-image { background: #f6f5f3; }
.jm-cart-image img {
  width: 105px;
  height: 130px;
  object-fit: contain;
  padding: 10px;
}
.jm-cart-row small { font-size: 9px; color: #888; }
.jm-cart-row h3 { font-size: 15px; margin: 5px 0; }
.jm-cart-row p { font-size: 12px; }
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
.jm-summary { padding: 28px; background: #f7f5f2; }
.jm-summary h2 { font-size: 23px; }
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
.jm-form { display: grid; gap: 18px; }
.jm-form label {
  display: grid;
  gap: 7px;
  font-size: 12px;
  font-weight: bold;
}
.jm-form textarea { resize: vertical; }
.jm-form .jm-note { margin: 0; }
.jm-auth {
  width: min(460px, 90%);
  margin: 75px auto;
}
.jm-auth h1 { font-size: 45px; }
.jm-auth > p:not(.jm-eyebrow) { color: #777; font-size: 13px; }
.jm-auth .jm-form { margin: 30px 0; }
.jm-auth > p a { color: #222; text-decoration: underline; }
.jm-account { background: #f7f5f2; padding: 35px; }
.jm-order {
  border: 1px solid #e4e4e4;
  padding: 28px;
  margin-bottom: 22px;
}
.jm-order .jm-heading { margin-bottom: 20px; }
.jm-order .jm-muted { margin: 5px 0 0; }
.jm-order-item {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  padding: 9px 0;
  font-size: 13px;
}
.jm-status {
  background: #f8e1ea;
  padding: 5px 13px;
  font-size: 11px;
  text-transform: capitalize;
}
.jm-success .jm-actions { justify-content: center; }
.jm-success-icon {
  display: inline-grid;
  place-items: center;
  background: #f5dbe6;
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
  background: #171717;
  color: white;
  padding: 55px 5% 25px;
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: 35px;
}
.jm-footer > div { display: flex; flex-direction: column; gap: 12px; }
.jm-footer .jm-logo { align-self: flex-start; }
.jm-footer p, .jm-footer div > a:not(.jm-logo) {
  font-size: 12px;
  color: #aaa;
}
.jm-footer strong { font-size: 13px; }
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
  background: #171717;
  color: white;
  padding: 15px 24px;
  max-width: 90vw;
  box-shadow: 0 5px 30px #0003;
  font-size: 13px;
  z-index: 100;
  text-align: center;
}
@media (max-width: 1000px) {
  .jm-header { flex-wrap: wrap; gap: 20px; }
  .jm-header nav {
    order: 3;
    width: 100%;
    justify-content: center;
  }
  .jm-categories { grid-template-columns: repeat(3, 1fr); }
  .jm-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .jm-two-columns { gap: 25px; grid-template-columns: 1fr 300px; }
  .jm-product-detail { gap: 30px; }
}
@media (max-width: 700px) {
  .jm-announcement { font-size: 8px; letter-spacing: 1px; }
  .jm-header { padding: 20px 5%; }
  .jm-logo { font-size: 25px; }
  .jm-header-actions { gap: 14px; font-size: 11px; }
  .jm-header nav { gap: 20px; font-size: 11px; }
  .jm-hero { grid-template-columns: 1fr; }
  .jm-hero-copy { padding: 50px 7%; }
  .jm-hero h1 { font-size: 66px; letter-spacing: -3px; }
  .jm-hero-art { min-height: 330px; }
  .jm-hero-art img { height: 300px; }
  .jm-hero-word { transform: none; font-size: 100px; }
  .jm-benefits { flex-wrap: wrap; gap: 8px 20px; font-size: 9px; }
  .jm-section { padding: 40px 5%; }
  .jm-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 25px 12px; }
  .jm-card-image img { padding: 15px; }
  .jm-card h3 { font-size: 13px; min-height: 37px; }
  .jm-card-body small { font-size: 8px; }
  .jm-card .jm-price { font-size: 11px; gap: 6px; }
  .jm-card .jm-price del { font-size: 9px; }
  .jm-badge { font-size: 7px; left: 7px; top: 9px; padding: 3px 5px; }
  .jm-heart { right: 7px; top: 7px; width: 27px; height: 27px; font-size: 20px; }
  .jm-categories button { padding: 16px 10px; gap: 5px; }
  .jm-categories button strong { font-size: 11px; }
  .jm-categories button span:first-child { display: none; }
  .jm-toolbar { flex-wrap: wrap; }
  .jm-toolbar input { flex-basis: 100%; }
  .jm-toolbar select { flex: 1; min-width: 0; font-size: 12px; }
  .jm-two-columns, .jm-product-detail { grid-template-columns: 1fr; }
  .jm-detail-image img { height: 350px; }
  .jm-product-detail { margin-bottom: 50px; }
  .jm-cart-row { grid-template-columns: 75px 1fr; gap: 15px; }
  .jm-cart-image img { width: 75px; height: 110px; }
  .jm-cart-end { grid-column: 2; flex-direction: row; }
  .jm-footer { grid-template-columns: 1fr 1fr; }
  .jm-footer > div:first-child { grid-column: 1 / -1; }
  .jm-order { padding: 18px; }
}
`;
