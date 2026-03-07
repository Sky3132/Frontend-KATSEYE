"use client";

import { useMemo, useState } from "react";
import StoreHeader from "../components/store-header";
import { getCartCount, getCartSubtotal, readCart, writeCart, type CartItem } from "../lib/cart";

const asCurrency = (value: number) => `$${value.toFixed(2)}`;

export default function CheckoutPage() {
  const [cart, setCart] = useState<CartItem[]>(() => readCart());
  const [orderPlaced, setOrderPlaced] = useState(false);

  const count = useMemo(() => getCartCount(cart), [cart]);
  const subtotal = useMemo(() => getCartSubtotal(cart), [cart]);

  const placeOrder = () => {
    writeCart([]);
    setCart([]);
    setOrderPlaced(true);
  };

  return (
    <main className="min-h-screen bg-[#f7f7f7] text-[#111]">
      <StoreHeader cartCount={count} onCartClick={() => {}} />
      <section className="mx-auto max-w-[900px] px-4 py-8 sm:px-6">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6">
          <h1 className="text-4xl font-semibold">Checkout</h1>
          <div className="mt-4 space-y-3">
            {cart.length === 0 ? (
              <p className="text-sm text-neutral-600">No items in cart.</p>
            ) : (
              cart.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span>
                    {item.name} x {item.qty}
                  </span>
                  <span>{asCurrency(item.price * item.qty)}</span>
                </div>
              ))
            )}
          </div>
          <div className="mt-6 border-t border-neutral-200 pt-4">
            <p className="text-sm text-neutral-500">Subtotal</p>
            <p className="text-2xl font-semibold">{asCurrency(subtotal)}</p>
            <button
              type="button"
              className="mt-4 rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
              disabled={cart.length === 0}
              onClick={placeOrder}
            >
              Place Order
            </button>
            {orderPlaced ? <p className="mt-3 text-sm text-green-700">Order placed successfully.</p> : null}
          </div>
        </div>
      </section>
    </main>
  );
}
