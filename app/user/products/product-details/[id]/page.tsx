"use client";

import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import StoreHeader from "../../../components/store-header";
import { addToCart, getCartCount, notifyStore, readCart, type CartItem } from "../../../lib/cart";
import { getProductById } from "../../../lib/products";

const asCurrency = (value: number) => `$${value.toFixed(2)}`;

export default function ProductDetailsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const product = getProductById(params.id);
  const [cart, setCart] = useState<CartItem[]>(() => readCart());
  const [cartOpen, setCartOpen] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const [activeColor, setActiveColor] = useState(0);
  const [activeSize, setActiveSize] = useState(0);
  const [qty, setQty] = useState(1);

  const cartCount = useMemo(() => getCartCount(cart), [cart]);

  if (!product) {
    return (
      <main className="min-h-screen bg-[#f7f7f7]">
        <StoreHeader cartCount={cartCount} onCartClick={() => setCartOpen((prev) => !prev)} />
        <section className="mx-auto max-w-[1100px] px-6 py-16">
          <p className="text-xl">Product not found.</p>
          <button
            type="button"
            className="mt-4 rounded-xl bg-black px-4 py-2 text-white"
            onClick={() => router.push("/user/products")}
          >
            Back to products
          </button>
        </section>
      </main>
    );
  }

  const isOutOfStock = product.stock <= 0;
  const maxQty = Math.max(1, product.stock);

  const addCurrentProductToCart = () => {
    if (isOutOfStock) return;
    const next = addToCart(product, qty);
    setCart(next);
    notifyStore(`${product.name} added to cart.`);
  };

  const buyNow = () => {
    if (isOutOfStock) return;
    const next = addToCart(product, qty);
    setCart(next);
    notifyStore(`Ready to checkout: ${product.name}.`);
    router.push("/user/checkout");
  };

  return (
    <main className="min-h-screen bg-[#f5f5fa] text-[#111]">
      <StoreHeader cartCount={cartCount} onCartClick={() => setCartOpen((prev) => !prev)} />

      <section className="mx-auto mt-6 grid max-w-[1400px] gap-8 rounded-3xl border border-neutral-200 bg-white p-6 lg:grid-cols-[80px_1fr_430px]">
        <div className="space-y-3">
          {product.gallery.map((image, index) => (
            <button
              key={image}
              type="button"
              className={`h-20 w-16 rounded-md border ${
                activeImage === index ? "border-black" : "border-neutral-300"
              } bg-cover bg-center`}
              style={{ backgroundImage: `url('${image}')` }}
              onClick={() => setActiveImage(index)}
            />
          ))}
        </div>

        <div className="relative min-h-[560px] rounded-2xl bg-[#8ec5be]">
          <div
            className="h-full min-h-[560px] w-full rounded-2xl bg-contain bg-center bg-no-repeat"
            style={{ backgroundImage: `url('${product.gallery[activeImage]}')` }}
          />
        </div>

        <div className="space-y-4">
          <h1 className="text-5xl font-semibold">{product.name}</h1>
          <p className="text-2xl font-semibold">{asCurrency(product.price)}</p>
          <p
            className={`text-sm font-medium ${
              isOutOfStock
                ? "text-rose-600"
                : product.stock < 25
                  ? "text-amber-600"
                  : "text-emerald-600"
            }`}
          >
            {isOutOfStock ? "Out of stock" : `In stock: ${product.stock}`}
          </p>
          <p className="text-sm text-neutral-500">{product.description}</p>

          <div>
            <p className="mb-2 text-sm">Select Color</p>
            <div className="flex gap-2">
              {product.colors.map((color, index) => (
                <button
                  key={color}
                  type="button"
                  className={`h-7 w-7 rounded-full border-2 ${
                    activeColor === index ? "border-black" : "border-transparent"
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => setActiveColor(index)}
                />
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm">Select Size</p>
            <div className="flex flex-wrap gap-2">
              {product.sizes.map((size, index) => (
                <button
                  key={size}
                  type="button"
                  className={`min-w-12 rounded-md border px-3 py-2 text-sm ${
                    activeSize === index ? "border-black bg-black text-white" : "border-neutral-300"
                  }`}
                  onClick={() => setActiveSize(index)}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm">Quantity</p>
            <div className="inline-flex items-center rounded-md border border-neutral-300">
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
                className="px-3 py-2 disabled:text-neutral-400"
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
              className="rounded-lg border border-black px-4 py-3 disabled:cursor-not-allowed disabled:border-neutral-300 disabled:text-neutral-400"
              onClick={addCurrentProductToCart}
              disabled={isOutOfStock}
            >
              {isOutOfStock ? "Unavailable" : "Add to cart"}
            </button>
            <button
              type="button"
              className="rounded-lg bg-black px-4 py-3 text-white disabled:cursor-not-allowed disabled:bg-neutral-300"
              onClick={buyNow}
              disabled={isOutOfStock}
            >
              {isOutOfStock ? "Out of stock" : "Buy it now"}
            </button>
          </div>

          <div className="space-y-2 border-t border-neutral-200 pt-3">
            <details className="rounded-md border border-neutral-200 px-3 py-2" open>
              <summary className="cursor-pointer text-sm font-medium">Description</summary>
              <p className="mt-2 text-sm text-neutral-600">{product.description}</p>
            </details>
            <details className="rounded-md border border-neutral-200 px-3 py-2">
              <summary className="cursor-pointer text-sm font-medium">Shipping & Returns</summary>
              <p className="mt-2 text-sm text-neutral-600">Ships in 2-4 business days. 14-day return window.</p>
            </details>
            <details className="rounded-md border border-neutral-200 px-3 py-2">
              <summary className="cursor-pointer text-sm font-medium">Details</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-600">
                {product.details.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </details>
          </div>
        </div>
      </section>

      {cartOpen ? (
        <aside className="fixed inset-y-0 right-0 z-40 w-full max-w-sm border-l border-neutral-200 bg-white p-4 shadow-xl">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Cart</h2>
            <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => setCartOpen(false)}>
              Close
            </button>
          </div>
          <div className="space-y-2">
            {cart.length === 0 ? (
              <p className="text-sm text-neutral-500">Cart is empty.</p>
            ) : (
              cart.map((item) => (
                <div key={item.id} className="rounded border border-neutral-200 p-2 text-sm">
                  {item.name} x {item.qty}
                </div>
              ))
            )}
          </div>
        </aside>
      ) : null}
    </main>
  );
}
