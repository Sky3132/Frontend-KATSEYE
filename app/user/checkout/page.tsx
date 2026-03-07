"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import StoreHeader from "../components/store-header";
import {
  getCartCount,
  getCartServerSnapshot,
  getCartSubtotal,
  readCart,
  subscribeCart,
  writeCart,
} from "../lib/cart";

const asCurrency = (value: number) => `$${value.toFixed(2)}`;

const steps = [
  { id: 1, label: "Shopping Cart" },
  { id: 2, label: "Shipping Details" },
  { id: 3, label: "Payment Option" },
];

const paymentOptions = [
  { id: "card", label: "Credit / Debit Card", description: "Visa, Mastercard, AMEX accepted." },
  { id: "paypal", label: "PayPal", description: "Pay using your PayPal balance or linked card." },
  { id: "cod", label: "Cash on Delivery", description: "Pay when your package arrives." },
] as const;

type ShippingForm = {
  fullName: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  postalCode: string;
};

const initialShipping: ShippingForm = {
  fullName: "",
  phone: "",
  address: "",
  city: "",
  country: "",
  postalCode: "",
};

export default function CheckoutPage() {
  const router = useRouter();
  const cart = useSyncExternalStore(subscribeCart, readCart, getCartServerSnapshot);
  const [step, setStep] = useState<2 | 3>(2);
  const [shipping, setShipping] = useState<ShippingForm>(initialShipping);
  const [payment, setPayment] = useState<(typeof paymentOptions)[number]["id"]>("card");
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [error, setError] = useState("");

  const cartCount = useMemo(() => getCartCount(cart), [cart]);
  const subtotal = useMemo(() => getCartSubtotal(cart), [cart]);
  const shippingFee = cart.length > 0 ? 12 : 0;
  const tax = subtotal * 0.08;
  const total = subtotal + shippingFee + tax;

  const updateField = (field: keyof ShippingForm, value: string) => {
    setShipping((prev) => ({ ...prev, [field]: value }));
  };

  const continueToPayment = () => {
    const requiredFields: (keyof ShippingForm)[] = [
      "fullName",
      "phone",
      "address",
      "city",
      "country",
      "postalCode",
    ];

    const hasEmptyField = requiredFields.some((field) => !shipping[field].trim());
    if (hasEmptyField) {
      setError("Complete all shipping details before continuing.");
      return;
    }

    setError("");
    setStep(3);
  };

  const placeOrder = () => {
    if (cart.length === 0) {
      setError("Your cart is empty.");
      return;
    }

    setError("");
    writeCart([]);
    setOrderPlaced(true);
  };

  return (
    <main className="min-h-screen bg-[#f7f7f7] text-[#111] transition-colors dark:bg-[#060606] dark:bg-[radial-gradient(circle_at_top,rgba(118,100,26,0.16),transparent_16%),linear-gradient(180deg,#050505_0%,#090909_38%,#0b0b0a_100%)] dark:text-[#f0d34f]">
      <StoreHeader cartCount={cartCount} />

      <section className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">
        <div className="mb-8 flex flex-wrap items-center justify-center gap-4">
          {steps.map((item, index) => (
            <div key={item.id} className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <span
                  className={`grid h-8 w-8 place-items-center rounded-full text-sm font-semibold ${
                    item.id <= step
                      ? "bg-[#111827] text-white dark:bg-[#f0d34f] dark:text-[#090909]"
                      : "bg-neutral-100 text-neutral-500 dark:bg-[#141412] dark:text-[#cfbd78]"
                  }`}
                >
                  {item.id}
                </span>
                <span className="text-sm font-medium">{item.label}</span>
              </div>
              {index < steps.length - 1 ? (
                <span className="hidden h-px w-24 bg-neutral-300 dark:bg-[#2c2817] sm:block" />
              ) : null}
            </div>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-[28px] border border-neutral-200 bg-white p-6 shadow-sm dark:border-[#2c2817] dark:bg-[#070707] dark:shadow-[0_0_0_1px_rgba(214,183,54,0.1)]">
            {orderPlaced ? (
              <div className="space-y-4 text-center">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-neutral-500 dark:text-[#cfbd78]">
                  Order Confirmed
                </p>
                <h1 className="text-4xl font-semibold">Your order has been placed.</h1>
                <p className="text-sm text-neutral-500 dark:text-[#cfbd78]">
                  Shipping to: {shipping.address}, {shipping.city}, {shipping.country} {shipping.postalCode}
                </p>
                <button
                  type="button"
                  className="rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white dark:bg-[#f0d34f] dark:text-[#090909]"
                  onClick={() => router.push("/user/history")}
                >
                  View Orders
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-3xl font-semibold">
                      {step === 2 ? "Shipping Details" : "Payment Option"}
                    </h1>
                    <p className="mt-2 text-sm text-neutral-500 dark:text-[#cfbd78]">
                      {step === 2
                        ? "Enter the address and contact details needed for delivery."
                        : "Choose a payment method and review the shipping address."}
                    </p>
                  </div>
                  {step === 3 ? (
                    <button
                      type="button"
                      className="rounded-xl border border-neutral-300 px-4 py-2 text-sm dark:border-[#d6b736]"
                      onClick={() => setStep(2)}
                    >
                      Back
                    </button>
                  ) : null}
                </div>

                {step === 2 ? (
                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    <input
                      type="text"
                      placeholder="Full Name"
                      value={shipping.fullName}
                      onChange={(event) => updateField("fullName", event.target.value)}
                      className="h-12 rounded-2xl border border-neutral-300 px-4 dark:border-[#d6b736] dark:bg-[#050505] dark:text-[#f0d34f] dark:placeholder:text-[#8e7727]"
                    />
                    <input
                      type="tel"
                      placeholder="Phone Number"
                      value={shipping.phone}
                      onChange={(event) => updateField("phone", event.target.value)}
                      className="h-12 rounded-2xl border border-neutral-300 px-4 dark:border-[#d6b736] dark:bg-[#050505] dark:text-[#f0d34f] dark:placeholder:text-[#8e7727]"
                    />
                    <input
                      type="text"
                      placeholder="Country"
                      value={shipping.country}
                      onChange={(event) => updateField("country", event.target.value)}
                      className="h-12 rounded-2xl border border-neutral-300 px-4 dark:border-[#d6b736] dark:bg-[#050505] dark:text-[#f0d34f] dark:placeholder:text-[#8e7727]"
                    />
                    <input
                      type="text"
                      placeholder="City"
                      value={shipping.city}
                      onChange={(event) => updateField("city", event.target.value)}
                      className="h-12 rounded-2xl border border-neutral-300 px-4 dark:border-[#d6b736] dark:bg-[#050505] dark:text-[#f0d34f] dark:placeholder:text-[#8e7727]"
                    />
                    <input
                      type="text"
                      placeholder="Postal Code"
                      value={shipping.postalCode}
                      onChange={(event) => updateField("postalCode", event.target.value)}
                      className="h-12 rounded-2xl border border-neutral-300 px-4 dark:border-[#d6b736] dark:bg-[#050505] dark:text-[#f0d34f] dark:placeholder:text-[#8e7727]"
                    />
                    <textarea
                      placeholder="Street Address"
                      value={shipping.address}
                      onChange={(event) => updateField("address", event.target.value)}
                      className="min-h-[120px] rounded-2xl border border-neutral-300 px-4 py-3 md:col-span-2 dark:border-[#d6b736] dark:bg-[#050505] dark:text-[#f0d34f] dark:placeholder:text-[#8e7727]"
                    />
                  </div>
                ) : (
                  <div className="mt-6 space-y-4">
                    <div className="rounded-[24px] border border-neutral-200 p-4 dark:border-[#2c2817] dark:bg-[#0d0d0c]">
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500 dark:text-[#cfbd78]">
                        Selected Shipping Address
                      </p>
                      <p className="mt-3 text-lg font-semibold">{shipping.fullName}</p>
                      <p className="mt-2 text-sm text-neutral-500 dark:text-[#cfbd78]">
                        {shipping.address}, {shipping.city}, {shipping.country} {shipping.postalCode}
                      </p>
                      <p className="mt-1 text-sm text-neutral-500 dark:text-[#cfbd78]">{shipping.phone}</p>
                    </div>

                    <div className="space-y-3">
                      {paymentOptions.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          className={`w-full rounded-[24px] border p-4 text-left transition ${
                            payment === option.id
                              ? "border-[#111827] bg-neutral-50 dark:border-[#f0d34f] dark:bg-[#11110f]"
                              : "border-neutral-200 dark:border-[#2c2817] dark:bg-[#0d0d0c]"
                          }`}
                          onClick={() => setPayment(option.id)}
                        >
                          <p className="font-semibold">{option.label}</p>
                          <p className="mt-1 text-sm text-neutral-500 dark:text-[#cfbd78]">
                            {option.description}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}
              </>
            )}
          </div>

          <aside className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm dark:border-[#2c2817] dark:bg-[#070707] dark:shadow-[0_0_0_1px_rgba(214,183,54,0.1)]">
            <h2 className="text-2xl font-semibold">Order Summary</h2>
            <div className="mt-4 space-y-3 text-sm">
              {cart.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-4">
                  <span className="text-neutral-500 dark:text-[#cfbd78]">
                    {item.name} x {item.qty}
                  </span>
                  <span>{asCurrency(item.price * item.qty)}</span>
                </div>
              ))}
            </div>

            <div className="mt-5 space-y-3 border-t border-neutral-200 pt-4 text-sm dark:border-[#2c2817]">
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
              <div className="flex items-center justify-between border-t border-neutral-200 pt-3 text-base font-semibold dark:border-[#2c2817]">
                <span>Total Payable</span>
                <span>{asCurrency(total)}</span>
              </div>
            </div>

            {!orderPlaced ? (
              <button
                type="button"
                className="mt-5 w-full rounded-2xl bg-[#111827] px-4 py-3 text-sm font-semibold text-white dark:bg-[#f0d34f] dark:text-[#090909]"
                onClick={step === 2 ? continueToPayment : placeOrder}
                disabled={cart.length === 0}
              >
                {step === 2 ? "Continue to Payment" : "Place Order"}
              </button>
            ) : null}
          </aside>
        </div>
      </section>
    </main>
  );
}
