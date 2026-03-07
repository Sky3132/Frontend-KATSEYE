"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useSyncExternalStore } from "react";
import StoreHeader from "../components/store-header";
import {
  addToCart,
  getCartServerSnapshot,
  getCartCount,
  getCartSubtotal,
  notifyStore,
  readCart,
  removeFromCart,
  subscribeCart,
} from "../lib/cart";
import { products } from "../lib/products";

const asCurrency = (value: number) => `$${value.toFixed(2)}`;

export default function ProductsPage() {
  const router = useRouter();
  const cart = useSyncExternalStore(subscribeCart, readCart, getCartServerSnapshot);
  const [cartOpen, setCartOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const cartCount = useMemo(() => getCartCount(cart), [cart]);
  const subtotal = useMemo(() => getCartSubtotal(cart), [cart]);
  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return products;

    return products.filter((product) =>
      [product.name, product.brand, product.description].some((value) =>
        value.toLowerCase().includes(query),
      ),
    );
  }, [searchQuery]);

  const handleAddToCart = (productId: string) => {
    const product = products.find((item) => item.id === productId);
    if (!product) return;
    addToCart(product, 1);
    notifyStore(`${product.name} added to your cart.`);
  };

  const handleRemove = (id: string) => {
    removeFromCart(id);
  };

  return (
    <main className="min-h-screen bg-[#f7f7f7] text-[#111]">
      <StoreHeader
        cartCount={cartCount}
        onCartClick={() => setCartOpen((prev) => !prev)}
      />

      <section className="mx-auto max-w-[1400px] px-4 pb-14 pt-10 sm:px-6">
        <div className="mb-8 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-emerald-700">
              Curated Catalog
            </p>
            <h1 className="mt-3 text-5xl font-semibold tracking-tight sm:text-6xl">
              You might also like
            </h1>
            <p className="mt-3 max-w-2xl text-base text-neutral-500">
              Search the latest Katseye pieces by product name, brand, or description.
            </p>
          </div>

          <div className="w-full max-w-[720px] rounded-[28px] border border-neutral-200 bg-white p-2 shadow-sm">
            <div className="grid gap-2 md:grid-cols-[140px_minmax(0,1fr)_auto]">
              <div className="flex items-center rounded-2xl border border-neutral-200 px-4 py-3 text-sm font-medium text-neutral-500">
                All
              </div>
              <label className="flex items-center rounded-2xl border border-neutral-200 px-4 py-3">
                <span className="mr-3 text-neutral-400" aria-hidden="true">
                  Search
                </span>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search products"
                  className="w-full bg-transparent text-sm text-black outline-none placeholder:text-neutral-400"
                />
              </label>
              <div className="flex items-center justify-center rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white">
                {filteredProducts.length} results
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {filteredProducts.map((product) => (
            (() => {
              const isOutOfStock = product.stock <= 0;
              const stockText = isOutOfStock
                ? "Out of stock"
                : product.stock < 25
                  ? `Low stock: ${product.stock}`
                  : `In stock: ${product.stock}`;
              const stockClass = isOutOfStock
                ? "text-rose-600"
                : product.stock < 25
                  ? "text-amber-600"
                  : "text-emerald-600";

              return (
            <article
              key={product.id}
              onClick={() =>
                router.push(`/user/products/product-details/${product.id}`)
              }
              className="cursor-pointer overflow-hidden rounded-2xl border border-neutral-200 bg-white transition hover:-translate-y-1 hover:shadow-xl"
            >
              <div
                className="h-[360px] w-full bg-cover bg-center"
                style={{ backgroundImage: `url('${product.image}')` }}
              />
              <div className="space-y-1 p-5">
                <h2 className="text-3xl font-semibold">{product.name}</h2>
                <p className="text-xl text-neutral-500">{product.brand}</p>
                <p className="text-3xl font-semibold">
                  {asCurrency(product.price)}
                </p>
                <p className={`text-sm font-medium ${stockClass}`}>{stockText}</p>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleAddToCart(product.id);
                  }}
                  disabled={isOutOfStock}
                  className="mt-3 w-full rounded-xl bg-black px-4 py-2 text-xl font-medium text-white disabled:cursor-not-allowed disabled:bg-neutral-300"
                >
                  {isOutOfStock ? "Unavailable" : "Add to cart"}
                </button>
              </div>
            </article>
              );
            })()
          ))}
        </div>
        {filteredProducts.length === 0 ? (
          <div className="mt-10 rounded-[28px] border border-dashed border-neutral-300 bg-white px-6 py-12 text-center">
            <p className="text-lg font-semibold text-black">No products match that search.</p>
            <p className="mt-2 text-sm text-neutral-500">
              Try a different product name, brand, or keyword.
            </p>
          </div>
        ) : null}
      </section>

      {cartOpen ? (
        <aside className="fixed inset-y-0 right-0 z-40 w-full max-w-md border-l border-neutral-200 bg-white p-4 shadow-2xl">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-2xl font-semibold">Your Cart</h3>
            <button
              type="button"
              className="rounded-lg border border-neutral-300 px-3 py-1 text-sm"
              onClick={() => setCartOpen(false)}
            >
              Close
            </button>
          </div>
          <div className="max-h-[70vh] space-y-3 overflow-auto">
            {cart.length === 0 ? (
              <p className="text-sm text-neutral-500">Cart is empty.</p>
            ) : (
              cart.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-xl border border-neutral-200 p-2"
                >
                  <div
                    className="h-16 w-16 rounded-md bg-cover bg-center"
                    style={{ backgroundImage: `url('${item.image}')` }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {item.name}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {item.qty} x {asCurrency(item.price)}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="rounded-md border border-neutral-300 px-2 py-1 text-xs"
                    onClick={() => handleRemove(item.id)}
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="mt-4 border-t border-neutral-200 pt-3">
            <p className="text-sm text-neutral-500">Subtotal</p>
            <p className="text-2xl font-semibold">{asCurrency(subtotal)}</p>
            <button
              type="button"
              className="mt-3 w-full rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white"
              onClick={() => router.push("/user/checkout")}
            >
              Go to checkout
            </button>
          </div>
        </aside>
      ) : null}
    </main>
  );
}
