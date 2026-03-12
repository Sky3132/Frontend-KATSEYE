"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import StoreHeader from "../components/store-header";
import {
  getCartCount,
  getCartServerSnapshot,
  getSelectedCartServerSnapshot,
  getCartSubtotal,
  refreshCart,
  readCart,
  readSelectedCartItemIds,
  removeFromCart,
  subscribeCart,
  toggleSelectedCartItem,
  updateCartQty,
  writeSelectedCartItemIds,
} from "../lib/cart";
import { fetchProducts, type Product } from "../lib/catalog-api";
import { useStoreSettings } from "../lib/store-settings";

export default function CartPage() {
  const router = useRouter();
  const cart = useSyncExternalStore(subscribeCart, readCart, getCartServerSnapshot);
  const selectedIds = useSyncExternalStore(
    subscribeCart,
    readSelectedCartItemIds,
    getSelectedCartServerSnapshot,
  );
  const { formatCurrency, t } = useStoreSettings();
  const [products, setProducts] = useState<Product[]>([]);
  const steps = [
    { id: 1, label: t("shoppingCart") },
    { id: 2, label: t("shippingDetails") },
    { id: 3, label: t("paymentOption") },
  ];

  const cartCount = useMemo(() => getCartCount(cart), [cart]);
  const selectedItems = useMemo(
    () => cart.filter((item) => selectedIds.includes(item.id)),
    [cart, selectedIds],
  );
  const subtotal = useMemo(() => getCartSubtotal(selectedItems), [selectedItems]);
  const shippingFee = selectedItems.length > 0 ? 12 : 0;
  const tax = subtotal * 0.08;
  const total = subtotal + shippingFee + tax;
  const suggestions = products.filter((product) => !cart.some((item) => item.productId === product.id)).slice(0, 2);
  const allSelected = cart.length > 0 && selectedItems.length === cart.length;

  useEffect(() => {
    void refreshCart();
    void fetchProducts().then(setProducts).catch(() => setProducts([]));
  }, []);

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
              <h1 className="text-3xl font-semibold">{t("shoppingCart")}</h1>
              <p className="mt-2 text-sm text-neutral-500 dark:text-[#cfbd78]">{t("reviewItems")}</p>
            </div>

            <div className="space-y-4">
              {cart.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-neutral-300 px-6 py-10 text-center dark:border-[#d6b736]/35">
                  <p className="text-lg font-semibold">{t("yourCartIsEmpty")}</p>
                  <button
                    type="button"
                    className="mt-4 rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white dark:bg-[#f0d34f] dark:text-[#090909]"
                    onClick={() => router.push("/user/products")}
                  >
                    {t("continueShopping")}
                  </button>
                </div>
              ) : (
                <>
                  <label className="flex items-center gap-3 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() =>
                        writeSelectedCartItemIds(allSelected ? [] : cart.map((item) => item.id))
                      }
                      className="h-4 w-4 accent-[#111827] dark:accent-[#f0d34f]"
                    />
                    <span>Select cart items for checkout</span>
                  </label>

                  {cart.map((item) => (
                    <article
                      key={item.id}
                      className="grid gap-4 rounded-[24px] border border-neutral-200 p-4 dark:border-[#2c2817] dark:bg-[#0d0d0c] md:grid-cols-[28px_88px_minmax(0,1fr)_140px_120px_40px]"
                    >
                      <label className="flex items-start pt-7">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(item.id)}
                          onChange={() => toggleSelectedCartItem(item.id)}
                          className="h-4 w-4 accent-[#111827] dark:accent-[#f0d34f]"
                        />
                      </label>
                      <div
                        className="h-20 rounded-2xl bg-cover bg-center"
                        style={{ backgroundImage: `url('${item.image}')` }}
                      />
                      <div>
                        <p className="text-lg font-semibold">{item.name}</p>
                        <p className="mt-2 text-sm text-neutral-500 dark:text-[#cfbd78]">
                          {t("officialInCart")}
                        </p>
                        <p className="mt-1 text-sm text-neutral-500 dark:text-[#cfbd78]">
                          Size: {item.size || "Default"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="grid h-9 w-9 place-items-center rounded-xl border border-neutral-300 dark:border-[#d6b736]"
                          onClick={() => void updateCartQty(item.id, item.qty - 1)}
                        >
                          -
                        </button>
                        <span className="grid h-9 min-w-10 place-items-center rounded-xl bg-neutral-100 px-3 text-sm font-semibold dark:bg-[#11110f]">
                          {item.qty}
                        </span>
                        <button
                          type="button"
                          className="grid h-9 w-9 place-items-center rounded-xl border border-neutral-300 dark:border-[#d6b736]"
                          onClick={() => void updateCartQty(item.id, item.qty + 1)}
                        >
                          +
                        </button>
                      </div>
                      <div className="flex items-center justify-between text-lg font-semibold md:justify-end">
                        {formatCurrency(item.price * item.qty)}
                      </div>
                      <button
                        type="button"
                        aria-label={`Remove ${item.name}`}
                        className="grid h-10 w-10 place-items-center rounded-xl border border-neutral-300 text-sm dark:border-[#d6b736]"
                        onClick={() => void removeFromCart(item.id)}
                      >
                        x
                      </button>
                    </article>
                  ))}
                </>
              )}
            </div>

            {suggestions.length > 0 ? (
              <div className="pt-4">
                <h2 className="text-2xl font-semibold">{t("youMayAlsoBeInterested")}</h2>
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
                        <p className="text-lg font-semibold">{formatCurrency(product.price)}</p>
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
                    <p className="font-semibold">{t("shippingInsurance")}</p>
                    <p className="mt-1 text-sm text-neutral-500 dark:text-[#cfbd78]">
                      {t("protectTransit")}
                    </p>
                  </div>
                  <span className="text-sm font-semibold">{formatCurrency(15)}</span>
                </div>
              </div>

              <div className="mt-4 rounded-[24px] border border-neutral-200 p-4 dark:border-[#2c2817] dark:bg-[#0d0d0c]">
                <h2 className="text-xl font-semibold">{t("orderSummary")}</h2>
                <p className="mt-2 text-sm text-neutral-500 dark:text-[#cfbd78]">
                  {selectedItems.length} item{selectedItems.length === 1 ? "" : "s"} selected
                </p>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-500 dark:text-[#cfbd78]">{t("subTotal")}</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-500 dark:text-[#cfbd78]">{t("shipping")}</span>
                    <span>{formatCurrency(shippingFee)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-500 dark:text-[#cfbd78]">{t("tax")}</span>
                    <span>{formatCurrency(tax)}</span>
                  </div>
                  <div className="border-t border-neutral-200 pt-3 text-base font-semibold dark:border-[#2c2817]">
                    <div className="flex items-center justify-between">
                      <span>{t("totalPayable")}</span>
                      <span>{formatCurrency(total)}</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="mt-5 w-full rounded-2xl bg-[#111827] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#f0d34f] dark:text-[#090909]"
                  onClick={() => router.push("/user/checkout")}
                  disabled={selectedItems.length === 0}
                >
                  {t("proceedToCheckout")}
                </button>
              </div>
            </div>

            <div className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm dark:border-[#2c2817] dark:bg-[#070707] dark:shadow-[0_0_0_1px_rgba(214,183,54,0.1)]">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500 dark:text-[#cfbd78]">
                {t("satisfactionTitle")}
              </p>
              <p className="mt-3 text-sm leading-7 text-neutral-500 dark:text-[#cfbd78]">
                {t("satisfactionText")}
              </p>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
