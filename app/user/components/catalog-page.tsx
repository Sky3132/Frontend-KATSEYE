"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useSyncExternalStore } from "react";
import StoreHeader from "./store-header";
import {
  addToCart,
  getCartCount,
  getCartServerSnapshot,
  notifyStore,
  readCart,
  subscribeCart,
} from "../lib/cart";
import type { Product } from "../lib/products";

type CatalogPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  products: Product[];
};

type SortOption = "featured" | "price-low" | "price-high";

const asCurrency = (value: number) => `$${value.toFixed(2)}`;

const statusLabel: Record<Product["status"], string> = {
  available: "Available",
  "pre-order": "Pre-Order",
  "sold-out": "Sold out",
};

const statusClass: Record<Product["status"], string> = {
  available: "text-emerald-600 dark:text-emerald-400",
  "pre-order": "text-amber-600 dark:text-amber-300",
  "sold-out": "text-rose-600 dark:text-rose-300",
};

const sortOptions: { id: SortOption; label: string }[] = [
  { id: "featured", label: "Featured" },
  { id: "price-low", label: "Lowest to Highest" },
  { id: "price-high", label: "Highest to Lowest" },
];

export default function CatalogPage({
  eyebrow,
  title,
  description,
  products,
}: CatalogPageProps) {
  const router = useRouter();
  const cart = useSyncExternalStore(subscribeCart, readCart, getCartServerSnapshot);
  const cartCount = useMemo(() => getCartCount(cart), [cart]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("featured");
  const [sortOpen, setSortOpen] = useState(false);
  const maxProductPrice = useMemo(
    () => Math.max(...products.map((product) => product.price), 0),
    [products],
  );
  const [priceLimit, setPriceLimit] = useState<number>(maxProductPrice);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    const next = products.filter((product) => {
      const matchesQuery =
        !normalizedQuery ||
        product.name.toLowerCase().includes(normalizedQuery) ||
        product.brand.toLowerCase().includes(normalizedQuery);
      return matchesQuery && product.price <= priceLimit;
    });

    if (sortBy === "price-low") {
      return [...next].sort((a, b) => a.price - b.price);
    }

    if (sortBy === "price-high") {
      return [...next].sort((a, b) => b.price - a.price);
    }

    return next;
  }, [priceLimit, products, searchQuery, sortBy]);

  return (
    <main className="min-h-screen bg-[#f5f5fa] text-[#111] transition-colors dark:bg-[#090909] dark:bg-[radial-gradient(circle_at_top,rgba(112,95,25,0.14),transparent_20%),linear-gradient(180deg,#080808_0%,#0c0c0b_100%)] dark:text-[#f1d04b]">
      <StoreHeader cartCount={cartCount} />

      <section className="mx-auto max-w-[1400px] px-4 pb-12 pt-6 sm:px-6 xl:px-0">
        <div className="rounded-[32px] border border-black/5 bg-white/90 p-6 shadow-sm transition-colors dark:border-[#2c2817] dark:bg-[linear-gradient(180deg,#0b0b0a_0%,#090909_100%)] dark:shadow-[0_0_0_1px_rgba(214,183,54,0.04)] sm:p-8">
          <div className="flex flex-col gap-8">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.36em] text-neutral-500 dark:text-[#b59d45]">
                {eyebrow}
              </p>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-2">
                  <h1 className="text-4xl font-semibold leading-none sm:text-6xl dark:text-[#f1d04b]">
                    {title}
                  </h1>
                  <p className="max-w-2xl text-sm text-neutral-600 dark:text-[#cdbb76] sm:text-lg">
                    {description}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)_auto] md:items-start">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setSortOpen((prev) => !prev)}
                  className="flex h-14 w-full items-center justify-between rounded-[22px] border border-neutral-300 bg-white px-5 text-left text-sm font-medium text-neutral-900 shadow-sm transition hover:border-neutral-400 dark:border-[#d6b736] dark:bg-[#0a0a09] dark:text-[#f1d04b] dark:shadow-[0_0_0_1px_rgba(214,183,54,0.12)]"
                >
                  <span>Featured</span>
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 12 12"
                    className={`h-3 w-3 transition-transform ${sortOpen ? "rotate-180" : ""}`}
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M2 4L6 8L10 4"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>

                {sortOpen ? (
                  <div className="absolute left-0 top-[calc(100%+10px)] z-20 w-full rounded-[24px] border border-neutral-200 bg-white p-4 shadow-[0_20px_50px_rgba(0,0,0,0.14)] dark:border-[#d6b736] dark:bg-[#090909] dark:shadow-[0_20px_60px_rgba(0,0,0,0.75)]">
                    <div className="space-y-2">
                      {sortOptions.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => {
                            setSortBy(option.id);
                            setSortOpen(false);
                          }}
                          className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm transition ${
                            sortBy === option.id
                              ? "bg-black text-white dark:bg-[#f1d04b] dark:text-[#090909]"
                              : "text-neutral-700 hover:bg-neutral-100 dark:text-[#d5c179] dark:hover:bg-[#11110f]"
                          }`}
                        >
                          <span>{option.label}</span>
                          {sortBy === option.id ? (
                            <span className="text-xs uppercase tracking-[0.24em]">On</span>
                          ) : null}
                        </button>
                      ))}
                    </div>

                    <div className="mt-4 rounded-[20px] border border-neutral-200 px-4 py-4 dark:border-[#2c2817] dark:bg-[#0d0d0c]">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-neutral-900 dark:text-[#f1d04b]">
                          Price Range
                        </p>
                        <span className="text-xs uppercase tracking-[0.2em] text-neutral-500 dark:text-[#b59d45]">
                          Up to {asCurrency(priceLimit)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={Math.max(maxProductPrice, 1)}
                        step={1}
                        value={priceLimit}
                        onChange={(event) => setPriceLimit(Number(event.target.value))}
                        className="mt-4 h-2 w-full cursor-pointer appearance-none rounded-full bg-neutral-200 accent-black dark:bg-[#1e1b0f] dark:accent-[#f1d04b]"
                      />
                      <div className="mt-2 flex items-center justify-between text-xs text-neutral-500 dark:text-[#b59d45]">
                        <span>{asCurrency(0)}</span>
                        <span>{asCurrency(maxProductPrice)}</span>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              <label className="flex h-14 items-center gap-3 rounded-[22px] border border-neutral-300 bg-white px-5 shadow-sm transition focus-within:border-neutral-500 dark:border-[#d6b736] dark:bg-[#0a0a09] dark:shadow-[0_0_0_1px_rgba(214,183,54,0.12)]">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-5 w-5 shrink-0 text-neutral-500 dark:text-[#cdbb76]"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M16 16L21 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search products"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-neutral-400 dark:text-[#f1d04b] dark:placeholder:text-[#8f7c38]"
                />
              </label>

              <div className="flex h-14 items-center justify-center rounded-[22px] border border-neutral-300 bg-white px-5 text-sm font-semibold text-neutral-900 shadow-sm dark:border-[#d6b736] dark:bg-[#f1d04b] dark:text-[#090909]">
                {filteredProducts.length} results
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              {filteredProducts.map((product) => (
                <article
                  key={product.id}
                  className="flex h-full flex-col overflow-hidden rounded-[24px] border border-neutral-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg dark:border-[#2c2817] dark:bg-[#0a0a09] dark:shadow-[0_0_0_1px_rgba(214,183,54,0.05)]"
                >
                  <button
                    type="button"
                    onClick={() => router.push(`/user/products/product-details/${product.id}`)}
                    className="block overflow-hidden text-left"
                  >
                    <div className="flex aspect-[4/5] items-center justify-center border-b border-neutral-200 bg-[#f3f3f1] p-0 dark:border-[#232114] dark:bg-[#2b2b2b]">
                      <img
                        src={product.image}
                        alt={product.name}
                        className="h-full w-full object-cover object-center"
                      />
                    </div>
                  </button>

                  <div className="flex flex-1 flex-col p-5">
                    <button
                      type="button"
                      onClick={() => router.push(`/user/products/product-details/${product.id}`)}
                      className="text-left"
                    >
                      <h2 className="text-2xl font-semibold leading-tight text-neutral-950 dark:text-[#f1d04b]">
                        {product.name}
                      </h2>
                    </button>
                    <p className="mt-2 text-lg text-neutral-600 dark:text-[#cdbb76]">
                      {product.brand}
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-neutral-950 dark:text-[#f1d04b]">
                      {asCurrency(product.price)}
                    </p>
                    <p className={`mt-1 text-sm font-medium ${statusClass[product.status]}`}>
                      {statusLabel[product.status]}
                    </p>

                    <button
                      type="button"
                      onClick={() => {
                        if (product.status === "sold-out") return;
                        addToCart(product);
                        notifyStore(`${product.name} added to cart.`);
                      }}
                      disabled={product.status === "sold-out"}
                      className="mt-auto rounded-[18px] border border-neutral-300 px-4 py-3 text-lg font-medium text-neutral-950 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#403710] dark:bg-[#080808] dark:text-[#f1d04b] dark:hover:bg-[#12110d] dark:disabled:border-[#2f2a16] dark:disabled:text-[#6f6337]"
                    >
                      {product.status === "sold-out" ? "Unavailable" : "Add to cart"}
                    </button>
                  </div>
                </article>
              ))}
            </div>

            {filteredProducts.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-neutral-300 px-6 py-12 text-center dark:border-[#4b3f14] dark:bg-[#0a0a09]">
                <p className="text-lg font-medium dark:text-[#f1d04b]">No products found.</p>
                <p className="mt-2 text-sm text-neutral-500 dark:text-[#b59d45]">
                  Try a different search or raise the price range.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
