"use client";

import { useRouter } from "next/navigation";
import { useMemo, useSyncExternalStore } from "react";
import StoreHeader from "../components/store-header";
import {
  getCartCount,
  getCartServerSnapshot,
  getCartSubtotal,
  readCart,
  removeFromCart,
  subscribeCart,
  updateCartQty,
} from "../lib/cart";
import { products } from "../lib/products";

const asCurrency = (value: number) => `$${value.toFixed(2)}`;

const steps = [
  { id: 1, label: "Shopping Cart" },
  { id: 2, label: "Shipping Details" },
  { id: 3, label: "Payment Option" },
];

export default function CartPage() {
  const router = useRouter();
  const cart = useSyncExternalStore(subscribeCart, readCart, getCartServerSnapshot);

  const cartCount = useMemo(() => getCartCount(cart), [cart]);
  const subtotal = useMemo(() => getCartSubtotal(cart), [cart]);
  const shippingFee = cart.length > 0 ? 12 : 0;
  const tax = subtotal * 0.08;
  const total = subtotal + shippingFee + tax;
  const suggestions = products.filter((product) => !cart.some((item) => item.id === product.id)).slice(0, 2);

  return (
    <main className="min-h-screen bg-[#f7f7f7] text-[#111] transition-colors dark:bg-[#060606] dark:bg-[radial-gradient(circle_at_top,rgba(118,100,26,0.16),transparent_16%),linear-gradient(180deg,#050505_0%,#090909_38%,#0b0b0a_100%)] dark:text-[#f0d34f]">
      <StoreHeader cartCount={cartCount} />

      <section className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">
        <div className="mb-8 flex flex-wrap items-center justify-center gap-4">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <span
                  className={`grid h-8 w-8 place-items-center rounded-full text-sm font-semibold ${
                    step.id === 1
                      ? "bg-[#111827] text-white dark:bg-[#f0d34f] dark:text-[#090909]"
                      : "bg-neutral-100 text-neutral-500 dark:bg-[#141412] dark:text-[#cfbd78]"
                  }`}
                >
                  {step.id}
                </span>
                <span className="text-sm font-medium">{step.label}</span>
              </div>
              {index < steps.length - 1 ? (
                <span className="hidden h-px w-24 bg-neutral-300 dark:bg-[#2c2817] sm:block" />
              ) : null}
            </div>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6 rounded-[28px] border border-neutral-200 bg-white p-6 shadow-sm dark:border-[#2c2817] dark:bg-[#070707] dark:shadow-[0_0_0_1px_rgba(214,183,54,0.1)]">
            <div>
              <h1 className="text-3xl font-semibold">Shopping Cart</h1>
              <p className="mt-2 text-sm text-neutral-500 dark:text-[#cfbd78]">
                Review your items before moving to shipping details.
              </p>
            </div>

            <div className="space-y-4">
              {cart.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-neutral-300 px-6 py-10 text-center dark:border-[#d6b736]/35">
                  <p className="text-lg font-semibold">Your cart is empty.</p>
                  <button
                    type="button"
                    className="mt-4 rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white dark:bg-[#f0d34f] dark:text-[#090909]"
                    onClick={() => router.push("/user/products")}
                  >
                    Continue Shopping
                  </button>
                </div>
              ) : (
                cart.map((item) => (
                  <article
                    key={item.id}
                    className="grid gap-4 rounded-[24px] border border-neutral-200 p-4 dark:border-[#2c2817] dark:bg-[#0d0d0c] md:grid-cols-[88px_minmax(0,1fr)_140px_120px_40px]"
                  >
                    <div
                      className="h-20 rounded-2xl bg-cover bg-center"
                      style={{ backgroundImage: `url('${item.image}')` }}
                    />
                    <div>
                      <p className="text-lg font-semibold">{item.name}</p>
                      <p className="mt-2 text-sm text-neutral-500 dark:text-[#cfbd78]">
                        Official KATSEYE product in your shopping cart.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="grid h-9 w-9 place-items-center rounded-xl border border-neutral-300 dark:border-[#d6b736]"
                        onClick={() => updateCartQty(item.id, item.qty - 1)}
                      >
                        -
                      </button>
                      <span className="grid h-9 min-w-10 place-items-center rounded-xl bg-neutral-100 px-3 text-sm font-semibold dark:bg-[#11110f]">
                        {item.qty}
                      </span>
                      <button
                        type="button"
                        className="grid h-9 w-9 place-items-center rounded-xl border border-neutral-300 dark:border-[#d6b736]"
                        onClick={() => updateCartQty(item.id, item.qty + 1)}
                      >
                        +
                      </button>
                    </div>
                    <div className="flex items-center justify-between text-lg font-semibold md:justify-end">
                      {asCurrency(item.price * item.qty)}
                    </div>
                    <button
                      type="button"
                      aria-label={`Remove ${item.name}`}
                      className="grid h-10 w-10 place-items-center rounded-xl border border-neutral-300 text-sm dark:border-[#d6b736]"
                      onClick={() => removeFromCart(item.id)}
                    >
                      🗑
                    </button>
                  </article>
                ))
              )}
            </div>

            {suggestions.length > 0 ? (
              <div className="pt-4">
                <h2 className="text-2xl font-semibold">You may also be interested</h2>
                <div className="mt-4 space-y-3">
                  {suggestions.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      className="grid w-full items-center gap-4 rounded-[22px] border border-neutral-200 p-4 text-left transition hover:-translate-y-0.5 dark:border-[#2c2817] dark:bg-[#0d0d0c] md:grid-cols-[72px_minmax(0,1fr)_120px]"
                      onClick={() => router.push(`/user/products/product-details/${product.id}`)}
                    >
                      <div
                        className="h-16 rounded-2xl bg-cover bg-center"
                        style={{ backgroundImage: `url('${product.image}')` }}
                      />
                      <div>
                        <p className="font-semibold">{product.name}</p>
                        <p className="mt-1 text-sm text-neutral-500 dark:text-[#cfbd78]">{product.brand}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold">{asCurrency(product.price)}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <aside className="space-y-4">
            <div className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm dark:border-[#2c2817] dark:bg-[#070707] dark:shadow-[0_0_0_1px_rgba(214,183,54,0.1)]">
              <div className="rounded-[24px] border border-neutral-200 p-4 dark:border-[#2c2817] dark:bg-[#0d0d0c]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">Shipping Insurance</p>
                    <p className="mt-1 text-sm text-neutral-500 dark:text-[#cfbd78]">
                      Protect your order from loss, theft, or damage in transit.
                    </p>
                  </div>
                  <span className="text-sm font-semibold">$15</span>
                </div>
              </div>

              <div className="mt-4 rounded-[24px] border border-neutral-200 p-4 dark:border-[#2c2817] dark:bg-[#0d0d0c]">
                <h2 className="text-xl font-semibold">Order Summary</h2>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-500 dark:text-[#cfbd78]">Sub Total</span>
                    <span>{asCurrency(subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-500 dark:text-[#cfbd78]">Shipping</span>
                    <span>{asCurrency(shippingFee)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-500 dark:text-[#cfbd78]">Tax</span>
                    <span>{asCurrency(tax)}</span>
                  </div>
                  <div className="border-t border-neutral-200 pt-3 text-base font-semibold dark:border-[#2c2817]">
                    <div className="flex items-center justify-between">
                      <span>Total Payable</span>
                      <span>{asCurrency(total)}</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="mt-5 w-full rounded-2xl bg-[#111827] px-4 py-3 text-sm font-semibold text-white dark:bg-[#f0d34f] dark:text-[#090909]"
                  onClick={() => router.push("/user/checkout")}
                  disabled={cart.length === 0}
                >
                  Proceed to Secure Checkout
                </button>
              </div>
            </div>

            <div className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm dark:border-[#2c2817] dark:bg-[#070707] dark:shadow-[0_0_0_1px_rgba(214,183,54,0.1)]">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500 dark:text-[#cfbd78]">
                Your Satisfaction Is Guaranteed
              </p>
              <p className="mt-3 text-sm leading-7 text-neutral-500 dark:text-[#cfbd78]">
                We only surface curated KATSEYE products here. If something is wrong with your
                order, contact support and we will help with the next steps.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
