"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import StoreHeader from "../../../components/store-header";
import {
  addToCart,
  getCartCount,
  getCartServerSnapshot,
  notifyStore,
  readCart,
  subscribeCart,
  selectOnlyCartItem,
} from "../../../lib/cart";
import { fetchProductById, type Product } from "../../../lib/catalog-api";
import { useStoreSettings } from "../../../lib/store-settings";

export default function ProductDetailsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { formatCurrency, t } = useStoreSettings();
  const cart = useSyncExternalStore(subscribeCart, readCart, getCartServerSnapshot);
  const [product, setProduct] = useState<Product | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const [activeSize, setActiveSize] = useState(0);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    void fetchProductById(params.id).then(setProduct).catch(() => setProduct(null));
  }, [params.id]);

  const cartCount = useMemo(() => getCartCount(cart), [cart]);

  if (!product) {
    return (
      <main className="min-h-screen bg-[#f7f7f7] transition-colors dark:bg-[#090909] dark:text-[#f1d04b]">
        <StoreHeader cartCount={cartCount} />
        <section className="mx-auto max-w-[1100px] px-6 py-16">
          <p className="text-xl">{t("productNotFound")}</p>
          <button
            type="button"
            className="mt-4 rounded-xl bg-black px-4 py-2 text-white dark:bg-[#f1d04b] dark:text-[#090909]"
            onClick={() => router.push("/user/products")}
          >
            {t("backToProducts")}
          </button>
        </section>
      </main>
    );
  }

  const isOutOfStock = !product.inStock || product.stock <= 0 || product.status === "sold-out";
  const maxQty = Math.max(1, product.stock);
  const statusText =
    product.status === "pre-order"
      ? "Pre-Order"
      : product.status === "sold-out"
        ? "Sold out"
        : "Available";
  const statusClass =
    product.status === "pre-order"
      ? "text-amber-600"
      : product.status === "sold-out"
        ? "text-rose-600"
        : "text-emerald-600";
  const canAdvanceGallery = product.gallery.length > 1;
  const selectedSize = product.sizes[activeSize] ?? "";
  const addCurrentProductToCart = async () => {
    if (isOutOfStock) return;
    await addToCart(product, qty);
    notifyStore({
      message: `${product.name}${selectedSize ? ` (${selectedSize})` : ""} added to cart.`,
      productId: product.id,
      image: product.gallery?.[0] ?? "",
    });
  };

  const buyNow = async () => {
    if (isOutOfStock) return;
    const next = await addToCart(product, qty);
    const target = [...next].reverse().find((item) => item.productId === product.id);
    if (target) {
      selectOnlyCartItem(target.id);
    }
    notifyStore({
      message: `Ready to checkout: ${product.name}${selectedSize ? ` (${selectedSize})` : ""}.`,
      productId: product.id,
      image: product.gallery?.[0] ?? "",
    });
    router.push("/user/cart");
  };

  return (
    <main className="min-h-screen bg-[#f5f5fa] text-[#111] transition-colors dark:bg-[#090909] dark:bg-[radial-gradient(circle_at_top,rgba(112,95,25,0.14),transparent_20%),linear-gradient(180deg,#080808_0%,#0c0c0b_100%)] dark:text-[#f1d04b]">
      <StoreHeader cartCount={cartCount} />

      <section className="mx-auto mt-6 grid max-w-[1400px] gap-8 px-4 pb-10 sm:px-6 xl:grid-cols-[minmax(0,1fr)_430px] xl:px-0">
        <div className="grid overflow-hidden rounded-[28px] border border-neutral-200 bg-[#f3f3f1] dark:border-[#2c2817] dark:bg-[#2b2b2b]">
          <div className="grid min-h-[620px] lg:grid-cols-[88px_minmax(0,1fr)]">
            <div className="flex gap-3 overflow-x-auto p-4 lg:flex-col lg:overflow-visible lg:p-5">
              {product.gallery.map((image, index) => (
                <button
                  key={image}
                  type="button"
                  className={`h-20 w-16 shrink-0 rounded-md border-2 ${
                    activeImage === index
                      ? "border-black dark:border-[#f1d04b]"
                      : "border-transparent"
                  } bg-[#ecece7] bg-center bg-no-repeat transition dark:bg-[#202020]`}
                  style={{ backgroundImage: `url('${image}')`, backgroundSize: "contain" }}
                  onClick={() => setActiveImage(index)}
                />
              ))}
            </div>

            <div className="relative flex min-h-[520px] items-center justify-center p-6 sm:p-10">
              <div
                className="h-full min-h-[520px] w-full bg-contain bg-center bg-no-repeat"
                style={{ backgroundImage: `url('${product.gallery[activeImage]}')` }}
              />

              {canAdvanceGallery ? (
                <button
                  type="button"
                  aria-label="Next image"
                  className="absolute right-4 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/20 text-[#ffe500] backdrop-blur-sm transition hover:bg-black/35"
                  onClick={() => setActiveImage((prev) => (prev + 1) % product.gallery.length)}
                >
                  <span className="text-4xl leading-none">›</span>
                </button>
              ) : null}

              {canAdvanceGallery ? (
                <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-2">
                  {product.gallery.map((image, index) => (
                    <button
                      key={`${image}-dot`}
                      type="button"
                      aria-label={`Show image ${index + 1}`}
                      className={`h-2.5 w-2.5 rounded-full transition ${
                        activeImage === index ? "bg-[#ffe500]" : "bg-black/55"
                      }`}
                      onClick={() => setActiveImage(index)}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="space-y-4 rounded-[28px] border border-neutral-200 bg-white p-6 dark:border-[#2f2a16] dark:bg-[#090909] dark:shadow-[0_0_0_1px_rgba(217,185,47,0.08)]">
          <h1 className="text-5xl font-semibold">{product.name}</h1>
          <p className="text-2xl font-semibold">{formatCurrency(product.price)}</p>
          <p className={`text-sm font-medium ${statusClass}`}>{statusText}</p>
          <p className="text-sm text-neutral-500 dark:text-[#c7ba81]">{product.description}</p>

          <div>
            <p className="mb-2 text-sm dark:text-[#d6c67f]">{t("selectSize")}</p>
            <div className="flex flex-wrap gap-2">
              {product.sizes.map((size, index) => (
                <button
                  key={size}
                  type="button"
                  className={`min-w-12 rounded-md border px-3 py-2 text-sm ${
                    activeSize === index ? "border-black bg-black text-white dark:border-[#f1d04b] dark:bg-[#f1d04b] dark:text-[#090909]" : "border-neutral-300 dark:border-[#d9b92f] dark:bg-[#080808]"
                  }`}
                  onClick={() => setActiveSize(index)}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm dark:text-[#d6c67f]">{t("quantity")}</p>
            <div className="inline-flex items-center rounded-md border border-neutral-300 dark:border-[#d9b92f] dark:bg-[#080808]">
              <button
                type="button"
                className="px-3 py-2"
                onClick={() => setQty((prev) => Math.max(1, prev - 1))}
                disabled={isOutOfStock}
              >
                -
              </button>
              <span className="px-4 py-2 text-sm font-medium">{qty}</span>
              <button
                type="button"
                className="px-3 py-2 disabled:text-neutral-400 dark:disabled:text-[#76683d]"
                onClick={() => setQty((prev) => Math.min(maxQty, prev + 1))}
                disabled={isOutOfStock || qty >= maxQty}
              >
                +
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="rounded-lg border border-black px-4 py-3 disabled:cursor-not-allowed disabled:border-neutral-300 disabled:text-neutral-400 dark:border-[#f1d04b] dark:text-[#f1d04b] dark:disabled:border-[#665a33] dark:disabled:text-[#76683d]"
              onClick={addCurrentProductToCart}
              disabled={isOutOfStock}
            >
              {isOutOfStock ? t("unavailable") : t("addToCart")}
            </button>
            <button
              type="button"
              className="rounded-lg bg-black px-4 py-3 text-white disabled:cursor-not-allowed disabled:bg-neutral-300 dark:bg-[#f1d04b] dark:text-[#090909] dark:disabled:bg-[#665a33]"
              onClick={buyNow}
              disabled={isOutOfStock}
            >
              {isOutOfStock ? t("outOfStock") : t("buyItNow")}
            </button>
          </div>

          <div className="space-y-2 border-t border-neutral-200 pt-3 dark:border-[#f1d04b]/15">
            <details className="rounded-md border border-neutral-200 px-3 py-2 dark:border-[#2f2a16] dark:bg-[#11110f]" open>
              <summary className="cursor-pointer text-sm font-medium">{t("description")}</summary>
              <p className="mt-2 text-sm text-neutral-600 dark:text-[#c7ba81]">{product.description}</p>
            </details>
            <details className="rounded-md border border-neutral-200 px-3 py-2 dark:border-[#2f2a16] dark:bg-[#11110f]">
              <summary className="cursor-pointer text-sm font-medium">{t("shippingReturns")}</summary>
              <p className="mt-2 text-sm text-neutral-600 dark:text-[#c7ba81]">{t("shippingReturnsText")}</p>
            </details>
            <details className="rounded-md border border-neutral-200 px-3 py-2 dark:border-[#2f2a16] dark:bg-[#11110f]">
              <summary className="cursor-pointer text-sm font-medium">{t("details")}</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-600 dark:text-[#c7ba81]">
                {product.details.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </details>
          </div>
        </div>
      </section>
    </main>
  );
}
