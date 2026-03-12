"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import StoreHeader from "../components/store-header";
import {
  getCartCount,
  getCartServerSnapshot,
  getSelectedCartServerSnapshot,
  getCartSubtotal,
  notifyStore,
  refreshCart,
  readCart,
  readSelectedCartItemIds,
  subscribeCart,
  writeSelectedCartItemIds,
} from "../lib/cart";
import { api } from "../../lib/api";
import {
  createAddress,
  fetchMyAddresses,
  type Address,
  type CreateAddressInput,
} from "../lib/address-api";
import {
  countries,
  getBarangayOptions,
  getCityOptions,
  getProvinceOptions,
  getRegionOptions,
} from "../lib/location-options";
import { useStoreSettings } from "../lib/store-settings";
import { requestProductsRefresh } from "../lib/use-live-products";

const paymentOptions = ["card", "ewallet", "cod"] as const;
const ewalletOptions = ["GCash", "PayPal", "Maya"] as const;

type ShippingForm = {
  fullName: string;
  email: string;
  address: string;
  region: string;
  province: string;
  city: string;
  barangay: string;
  country: string;
  postalCode: string;
};

const initialShipping: ShippingForm = {
  fullName: "",
  email: "",
  address: "",
  region: "",
  province: "",
  city: "",
  barangay: "",
  country: "",
  postalCode: "",
};

export default function CheckoutPage() {
  const router = useRouter();
  const cart = useSyncExternalStore(subscribeCart, readCart, getCartServerSnapshot);
  const selectedCartItemIds = useSyncExternalStore(
    subscribeCart,
    readSelectedCartItemIds,
    getSelectedCartServerSnapshot,
  );
  const { formatCurrency, t } = useStoreSettings();
  const steps = [
    { id: 1, label: t("shoppingCart") },
    { id: 2, label: t("shippingDetails") },
    { id: 3, label: t("paymentOption") },
  ];
  const [step, setStep] = useState<2 | 3>(2);
  const [shipping, setShipping] = useState<ShippingForm>(initialShipping);
  const [payment, setPayment] = useState<(typeof paymentOptions)[number]>("card");
  const [ewallet, setEwallet] = useState<(typeof ewalletOptions)[number]>("GCash");
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(true);
  const [useSavedAddress, setUseSavedAddress] = useState(true);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<{ paymentLabel: string; total: number } | null>(null);
  const [error, setError] = useState("");
  const [placingOrder, setPlacingOrder] = useState(false);
  const [placingStage, setPlacingStage] = useState<"payment" | "confirm" | "email">("payment");
  const [placingComplete, setPlacingComplete] = useState(false);
  const placingStartRef = useRef<number>(0);

  const checkoutItems = useMemo(
    () => cart.filter((item) => selectedCartItemIds.includes(item.id)),
    [cart, selectedCartItemIds],
  );
  const cartCount = useMemo(() => getCartCount(cart), [cart]);
  const subtotal = useMemo(() => getCartSubtotal(checkoutItems), [checkoutItems]);
  const shippingFee = checkoutItems.length > 0 ? 12 : 0;
  const tax = subtotal * 0.08;
  const total = subtotal + shippingFee + tax;
  const selectedAddress = addresses.find((address) => address.id === selectedAddressId) ?? null;
  const regionOptions = useMemo(() => getRegionOptions(shipping.country), [shipping.country]);
  const provinceOptions = useMemo(
    () => getProvinceOptions(shipping.country, shipping.region),
    [shipping.country, shipping.region],
  );
  const cityOptions = useMemo(() => {
    const options = getCityOptions(shipping.country, shipping.region, shipping.province);
    return shipping.city && !options.includes(shipping.city)
      ? [shipping.city, ...options]
      : options;
  }, [shipping.city, shipping.country, shipping.region, shipping.province]);
  const barangayOptions = useMemo(() => {
    const options = getBarangayOptions(shipping.country, shipping.province, shipping.city);
    return shipping.barangay && !options.includes(shipping.barangay)
      ? [shipping.barangay, ...options]
      : options;
  }, [shipping.barangay, shipping.city, shipping.country, shipping.province]);

  const paymentLabel =
    payment === "card"
      ? t("creditDebitCard")
      : payment === "ewallet"
        ? `E-Wallet${ewallet ? ` • ${ewallet}` : ""}`
        : t("cashOnDelivery");

  useEffect(() => {
    let cancelled = false;

    fetchMyAddresses()
      .then((items) => {
        if (cancelled) return;
        setAddresses(items);
        setSelectedAddressId(items[0]?.id ?? null);
        setUseSavedAddress(items.length > 0);
      })
      .catch(() => {
        if (cancelled) return;
        setAddresses([]);
        setSelectedAddressId(null);
        setUseSavedAddress(false);
      })
      .finally(() => {
        if (cancelled) return;
        setAddressesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const updateField = (field: keyof ShippingForm, value: string) => {
    setShipping((prev) => ({ ...prev, [field]: value }));
  };

  const selectClassName =
    "h-12 rounded-2xl border border-neutral-300 px-4 dark:border-[#d6b736] dark:bg-[#050505] dark:text-[#f0d34f]";
  const placeholderSelectClassName = `${selectClassName} text-neutral-500 dark:text-[#8e7727]`;

  const applySavedAddress = (address: Address) => {
    setSelectedAddressId(address.id);
    setUseSavedAddress(true);
    setShipping({
      fullName: address.full_name,
      email: address.email,
      address: address.street,
      region: address.region,
      province: address.province,
      city: address.city,
      barangay: address.barangay,
      country: address.country,
      postalCode: address.zip_code,
    });
  };

  const continueToPayment = () => {
    if (useSavedAddress && selectedAddress) {
      setError("");
      applySavedAddress(selectedAddress);
      setStep(3);
      return;
    }

    const requiredFields: (keyof ShippingForm)[] = [
      "fullName",
      "email",
      "address",
      "region",
      "province",
      "city",
      "barangay",
      "country",
      "postalCode",
    ];

    const hasEmptyField = requiredFields.some((field) => !shipping[field].trim());
    if (hasEmptyField) {
      setError(t("completeShipping"));
      return;
    }

    setError("");
    setStep(3);
  };

  const placeOrder = async () => {
    if (checkoutItems.length === 0) {
      setError(t("emptyCart"));
      return;
    }

    try {
      setPlacingOrder(true);
      setPlacingComplete(false);
      setPlacingStage("payment");
      placingStartRef.current = Date.now();
      const payment_method = payment === "ewallet" ? "ewallet" : payment;
      const orderStatus = payment_method === "cod" ? "pending" : "paid";
      const addressPayload: CreateAddressInput = {
        full_name: shipping.fullName.trim(),
        email: shipping.email.trim(),
        country: shipping.country.trim(),
        region: shipping.region.trim(),
        province: shipping.province.trim(),
        city: shipping.city.trim(),
        barangay: shipping.barangay.trim(),
        zip_code: shipping.postalCode.trim(),
        street: shipping.address.trim(),
      };

      let payload:
        | { payment_method: string; status?: string; address_id: number; courier?: string; shipping_fee?: number }
        | { payment_method: string; status?: string; address: CreateAddressInput; courier?: string; shipping_fee?: number };

      if (useSavedAddress && selectedAddress) {
        payload = {
          payment_method,
          status: orderStatus,
          address_id: selectedAddress.id,
          courier: "Warehouse A",
          shipping_fee: shippingFee,
        };
      } else {
        let createdAddress: Address | null = null;
        try {
          createdAddress = await createAddress(addressPayload);
          if (createdAddress) {
            setAddresses((prev) => [
              createdAddress!,
              ...prev.filter((item) => item.id !== createdAddress!.id),
            ]);
            setSelectedAddressId(createdAddress.id);
            setUseSavedAddress(true);
          }
        } catch {
          createdAddress = null;
        }

        payload = createdAddress
          ? {
              payment_method,
              status: orderStatus,
              address_id: createdAddress.id,
              courier: "Warehouse A",
              shipping_fee: shippingFee,
            }
          : {
              payment_method,
              status: orderStatus,
              courier: "Warehouse A",
              shipping_fee: shippingFee,
              address: addressPayload,
            };
      }

      await api("/api/orders/checkout", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      // Force at least ~1.5s of "payment" so the UI feels realistic even on fast connections.
      const elapsed = Date.now() - placingStartRef.current;
      if (elapsed < 1500) {
        await new Promise((resolve) => setTimeout(resolve, 1500 - elapsed));
      }
      setPlacingStage("confirm");
      await new Promise((resolve) => setTimeout(resolve, 900));

      const featuredItem = checkoutItems[0] ?? null;
      notifyStore({
        message: `You placed an order worth ${formatCurrency(total)}.`,
        productId: featuredItem?.productId,
        image: featuredItem?.image ?? "",
      });

      setPlacingStage("email");
      await new Promise((resolve) => setTimeout(resolve, 1200));

      setError("");
      setPlacedOrder({ paymentLabel, total });
      writeSelectedCartItemIds([]);
      await refreshCart();
      requestProductsRefresh();
      setOrderPlaced(true);
      setPlacingComplete(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to place order.");
      setPlacingOrder(false);
      setPlacingComplete(false);
      return;
    }
  };

  return (
    <main className="min-h-screen bg-[#f7f7f7] text-[#111] transition-colors dark:bg-[#060606] dark:bg-[radial-gradient(circle_at_top,rgba(118,100,26,0.16),transparent_16%),linear-gradient(180deg,#050505_0%,#090909_38%,#0b0b0a_100%)] dark:text-[#f0d34f]">
      <StoreHeader cartCount={cartCount} />

      {placingOrder ? (
        <div className="fixed inset-0 z-[120] grid place-items-center bg-white/80 px-6 backdrop-blur-sm dark:bg-black/60">
          <div className="w-full max-w-[420px] rounded-[28px] border border-neutral-200 bg-white p-10 text-center shadow-[0_24px_80px_rgba(15,23,42,0.22)] dark:border-[#2c2817] dark:bg-[#090909]">
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-full border border-neutral-200 dark:border-[#2c2817]">
              <div className="relative grid h-12 w-12 place-items-center">
                <div className="absolute inset-0 rounded-full border-4 border-neutral-200 dark:border-[#2c2817]" />
                {!placingComplete ? (
                  <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-[#111827] dark:border-t-[#f1d04b]" />
                ) : null}
                <div className={`grid h-8 w-8 place-items-center rounded-full shadow-sm ${placingComplete ? "bg-emerald-500 text-white" : "bg-neutral-200 text-neutral-700 dark:bg-[#2c2817] dark:text-[#f1d04b]"}`}>
                  {placingComplete ? (
                    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M6 10.5L8.7 13.2L14 7.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <span className="text-xs font-semibold">…</span>
                  )}
                </div>
              </div>
            </div>
            <p className="mt-6 text-2xl font-semibold text-[#111] dark:text-[#f1d04b]">
              {placingComplete
                ? "Order processed"
                : placingStage === "payment"
                ? "Processing your payment"
                : placingStage === "confirm"
                  ? "Confirming your order"
                  : "Sending confirmation"}
            </p>
            <p className="mt-2 text-sm text-neutral-500 dark:text-[#cfbd78]">
              {placingComplete
                ? "Your order is placed. Email delivery depends on server SMTP and may take a few minutes."
                : placingStage === "payment"
                ? "Securing your transaction. Please don’t close this page."
                : placingStage === "confirm"
                  ? "Creating your order and reserving stock."
                  : `Preparing an email confirmation for ${shipping.email || "your email"}.`}
            </p>
            <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-[#2c2817]">
              <div
                className={`h-full rounded-full ${placingComplete ? "bg-emerald-500" : "bg-[#111827] dark:bg-[#f1d04b]"}`}
                style={{
                  width: placingComplete ? "100%" : placingStage === "payment" ? "35%" : placingStage === "confirm" ? "70%" : "90%",
                }}
              />
            </div>
            <div className="mt-6 space-y-2 text-left text-sm">
              <div className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${placingStage === "payment" ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-[#0b1b12] dark:text-emerald-100" : "border-neutral-200 text-neutral-500 dark:border-[#2c2817] dark:text-[#cfbd78]"}`}>
                <span>Payment</span>
                <span className="text-xs">{placingStage === "payment" && !placingComplete ? "In progress" : "Done"}</span>
              </div>
              <div className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${placingStage === "confirm" ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-[#0b1b12] dark:text-emerald-100" : placingStage === "email" ? "border-neutral-200 text-neutral-500 dark:border-[#2c2817] dark:text-[#cfbd78]" : "border-neutral-200 text-neutral-500 dark:border-[#2c2817] dark:text-[#cfbd78]"}`}>
                <span>Order confirmation</span>
                <span className="text-xs">{placingStage === "payment" ? "Waiting" : placingStage === "confirm" && !placingComplete ? "In progress" : "Done"}</span>
              </div>
              <div className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${placingStage === "email" ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-[#0b1b12] dark:text-emerald-100" : "border-neutral-200 text-neutral-500 dark:border-[#2c2817] dark:text-[#cfbd78]"}`}>
                <span>Email</span>
                <span className="text-xs">
                  {placingStage === "email" && !placingComplete ? "In progress" : placingComplete ? "Queued" : "Waiting"}
                </span>
              </div>
            </div>
            <button
              type="button"
              disabled={!placingComplete}
              onClick={() => {
                setPlacingOrder(false);
              }}
              className="mt-8 w-full rounded-2xl bg-[#111827] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#f1d04b] dark:text-[#090909]"
            >
              Continue
            </button>
          </div>
        </div>
      ) : null}

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
                <h1 className="text-4xl font-semibold">{t("yourOrderPlaced")}</h1>
                <p className="text-sm text-neutral-500 dark:text-[#cfbd78]">
                  {t("shippingTo")}: {shipping.address}, {shipping.barangay}, {shipping.city}, {shipping.province}, {shipping.region}, {shipping.country} {shipping.postalCode}
                </p>
                <p className="text-sm text-neutral-500 dark:text-[#cfbd78]">
                  Payment: {placedOrder?.paymentLabel ?? paymentLabel}
                </p>
                <p className="text-sm text-neutral-500 dark:text-[#cfbd78]">
                  Total: {formatCurrency(placedOrder?.total ?? total)}
                </p>
                <button
                  type="button"
                  className="rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white dark:bg-[#f0d34f] dark:text-[#090909]"
                  onClick={() => router.push("/user/account?section=orders")}
                >
                  {t("viewOrders")}
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-3xl font-semibold">
                      {step === 2 ? t("shippingDetails") : t("paymentOption")}
                    </h1>
                    <p className="mt-2 text-sm text-neutral-500 dark:text-[#cfbd78]">
                      {step === 2
                        ? t("enterShippingDetails")
                        : t("choosePaymentMethod")}
                    </p>
                  </div>
                  {step === 3 ? (
                    <button
                      type="button"
                      className="rounded-xl border border-neutral-300 px-4 py-2 text-sm dark:border-[#d6b736]"
                      onClick={() => setStep(2)}
                    >
                      {t("back")}
                    </button>
                  ) : null}
                </div>

                {step === 2 ? (
                  <div className="mt-6 space-y-5">
                    {addressesLoading ? (
                      <p className="text-sm text-neutral-500 dark:text-[#cfbd78]">
                        Loading saved addresses…
                      </p>
                    ) : null}
                    {addresses.length > 0 ? (
                      <div className="space-y-4">
                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            className={`rounded-2xl px-4 py-2 text-sm font-medium ${useSavedAddress ? "bg-[#111827] text-white dark:bg-[#f0d34f] dark:text-[#090909]" : "border border-neutral-300 dark:border-[#d6b736]"}`}
                            onClick={() => {
                              setUseSavedAddress(true);
                              if (selectedAddress) applySavedAddress(selectedAddress);
                            }}
                          >
                            Use Saved Address
                          </button>
                          <button
                            type="button"
                            className={`rounded-2xl px-4 py-2 text-sm font-medium ${!useSavedAddress ? "bg-[#111827] text-white dark:bg-[#f0d34f] dark:text-[#090909]" : "border border-neutral-300 dark:border-[#d6b736]"}`}
                            onClick={() => setUseSavedAddress(false)}
                          >
                            Add Another Address
                          </button>
                        </div>

                        {useSavedAddress ? (
                          <div className="space-y-3">
                            {addresses.map((address) => (
                              <button
                                key={address.id}
                                type="button"
                                className={`w-full rounded-[24px] border p-4 text-left transition ${
                                  selectedAddressId === address.id
                                    ? "border-[#111827] bg-neutral-50 dark:border-[#f0d34f] dark:bg-[#11110f]"
                                    : "border-neutral-200 dark:border-[#2c2817] dark:bg-[#0d0d0c]"
                                }`}
                                onClick={() => applySavedAddress(address)}
                              >
                                <p className="text-lg font-semibold">{address.full_name}</p>
                                <p className="mt-2 text-sm text-neutral-500 dark:text-[#cfbd78]">{address.street}</p>
                                <p className="text-sm text-neutral-500 dark:text-[#cfbd78]">
                                  {[address.barangay, address.city, address.province, address.region, address.country, address.zip_code].filter(Boolean).join(", ")}
                                </p>
                                <p className="mt-1 text-sm text-neutral-500 dark:text-[#cfbd78]">{address.email}</p>
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {!useSavedAddress || addresses.length === 0 ? (
                      <div className="grid gap-4 md:grid-cols-2">
                        <input
                          type="text"
                          placeholder={t("fullName")}
                          value={shipping.fullName}
                          onChange={(event) => updateField("fullName", event.target.value)}
                          className="h-12 rounded-2xl border border-neutral-300 px-4 dark:border-[#d6b736] dark:bg-[#050505] dark:text-[#f0d34f] dark:placeholder:text-[#8e7727]"
                        />
                        <input
                          type="email"
                          placeholder={t("email")}
                          value={shipping.email}
                          onChange={(event) => updateField("email", event.target.value)}
                          className="h-12 rounded-2xl border border-neutral-300 px-4 dark:border-[#d6b736] dark:bg-[#050505] dark:text-[#f0d34f] dark:placeholder:text-[#8e7727]"
                        />
                        <select
                          value={shipping.country}
                          onChange={(event) => {
                            updateField("country", event.target.value);
                            updateField("region", "");
                            updateField("province", "");
                            updateField("city", "");
                            updateField("barangay", "");
                          }}
                          className={shipping.country ? selectClassName : placeholderSelectClassName}
                        >
                          <option value="" disabled hidden>
                            {t("country")}
                          </option>
                          {countries.map((country) => (
                            <option key={country} value={country}>
                              {country}
                            </option>
                          ))}
                        </select>
                        <select
                          value={shipping.region}
                          onChange={(event) => {
                            updateField("region", event.target.value);
                            updateField("province", "");
                            updateField("city", "");
                            updateField("barangay", "");
                          }}
                          className={shipping.region ? selectClassName : placeholderSelectClassName}
                          disabled={!shipping.country}
                        >
                          <option value="" disabled hidden>
                            Region
                          </option>
                          {regionOptions.map((region) => (
                            <option key={region} value={region}>
                              {region}
                            </option>
                          ))}
                        </select>
                        <select
                          value={shipping.province}
                          onChange={(event) => {
                            updateField("province", event.target.value);
                            updateField("city", "");
                            updateField("barangay", "");
                          }}
                          className={shipping.province ? selectClassName : placeholderSelectClassName}
                          disabled={!shipping.region && shipping.country === "Philippines"}
                        >
                          <option value="" disabled hidden>
                            Province
                          </option>
                          {provinceOptions.map((province) => (
                            <option key={province} value={province}>
                              {province}
                            </option>
                          ))}
                        </select>
                        <select
                          value={shipping.city}
                          onChange={(event) => {
                            updateField("city", event.target.value);
                            updateField("barangay", "");
                          }}
                          className={shipping.city ? selectClassName : placeholderSelectClassName}
                          disabled={!shipping.province && shipping.country === "Philippines"}
                        >
                          <option value="" disabled hidden>
                            {t("city")}
                          </option>
                          {cityOptions.map((city) => (
                            <option key={city} value={city}>
                              {city}
                            </option>
                          ))}
                        </select>
                        <select
                          value={shipping.barangay}
                          onChange={(event) => updateField("barangay", event.target.value)}
                          className={shipping.barangay ? selectClassName : placeholderSelectClassName}
                          disabled={!shipping.city && shipping.country === "Philippines"}
                        >
                          <option value="" disabled hidden>
                            Barangay
                          </option>
                          {barangayOptions.map((barangay) => (
                            <option key={barangay} value={barangay}>
                              {barangay}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          placeholder={t("postalCode")}
                          value={shipping.postalCode}
                          onChange={(event) => updateField("postalCode", event.target.value)}
                          className="h-12 rounded-2xl border border-neutral-300 px-4 dark:border-[#d6b736] dark:bg-[#050505] dark:text-[#f0d34f] dark:placeholder:text-[#8e7727]"
                        />
                        <textarea
                          placeholder={t("streetAddress")}
                          value={shipping.address}
                          onChange={(event) => updateField("address", event.target.value)}
                          className="min-h-[120px] rounded-2xl border border-neutral-300 px-4 py-3 md:col-span-2 dark:border-[#d6b736] dark:bg-[#050505] dark:text-[#f0d34f] dark:placeholder:text-[#8e7727]"
                        />
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-6 space-y-4">
                    <div className="rounded-[24px] border border-neutral-200 p-4 dark:border-[#2c2817] dark:bg-[#0d0d0c]">
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500 dark:text-[#cfbd78]">
                        {t("selectedShippingAddress")}
                      </p>
                      <p className="mt-3 text-lg font-semibold">{useSavedAddress && selectedAddress ? selectedAddress.full_name : shipping.fullName}</p>
                      <p className="mt-2 text-sm text-neutral-500 dark:text-[#cfbd78]">
                        {useSavedAddress && selectedAddress
                          ? `${selectedAddress.street}, ${[selectedAddress.barangay, selectedAddress.city, selectedAddress.province, selectedAddress.region, selectedAddress.country, selectedAddress.zip_code].filter(Boolean).join(", ")}`
                          : `${shipping.address}, ${shipping.barangay}, ${shipping.city}, ${shipping.province}, ${shipping.region}, ${shipping.country} ${shipping.postalCode}`}
                      </p>
                      <p className="mt-1 text-sm text-neutral-500 dark:text-[#cfbd78]">{useSavedAddress && selectedAddress ? selectedAddress.email : shipping.email}</p>
                    </div>

                    <div className="space-y-3">
                      {paymentOptions.map((option) => (
                        <div
                          key={option}
                          className={`w-full rounded-[24px] border p-4 text-left transition ${
                            payment === option
                              ? "border-[#111827] bg-neutral-50 dark:border-[#f0d34f] dark:bg-[#11110f]"
                              : "border-neutral-200 dark:border-[#2c2817] dark:bg-[#0d0d0c]"
                          }`}
                        >
                          <button
                            type="button"
                            className="w-full text-left"
                            onClick={() => setPayment(option)}
                          >
                            <p className="font-semibold">
                              {option === "card"
                                ? t("creditDebitCard")
                                : option === "ewallet"
                                  ? "E-Wallet"
                                  : t("cashOnDelivery")}
                            </p>
                            <p className="mt-1 text-sm text-neutral-500 dark:text-[#cfbd78]">
                              {option === "card"
                                ? t("creditDebitCardDesc")
                                : option === "ewallet"
                                  ? `Choose from ${ewalletOptions.join(", ")}.`
                                  : t("cashOnDeliveryDesc")}
                            </p>
                          </button>

                          {option === "ewallet" && payment === "ewallet" ? (
                            <div className="mt-4 flex flex-wrap gap-2">
                              {ewalletOptions.map((wallet) => (
                                <button
                                  key={wallet}
                                  type="button"
                                  onClick={() => setEwallet(wallet)}
                                  className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
                                    ewallet === wallet
                                      ? "border-[#111827] bg-[#111827] text-white dark:border-[#f0d34f] dark:bg-[#f0d34f] dark:text-[#090909]"
                                      : "border-neutral-300 text-neutral-700 dark:border-[#d6b736] dark:text-[#cfbd78]"
                                  }`}
                                >
                                  {wallet}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}
              </>
            )}
          </div>

          <aside className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm dark:border-[#2c2817] dark:bg-[#070707] dark:shadow-[0_0_0_1px_rgba(214,183,54,0.1)]">
            <h2 className="text-2xl font-semibold">{t("orderSummary")}</h2>
            <div className="mt-4 space-y-3 text-sm">
              {checkoutItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-4">
                  <span className="text-neutral-500 dark:text-[#cfbd78]">
                    {item.name} {item.size ? `(${item.size}) ` : ""}x {item.qty}
                  </span>
                  <span>{formatCurrency(item.price * item.qty)}</span>
                </div>
              ))}
            </div>

            <div className="mt-5 space-y-3 border-t border-neutral-200 pt-4 text-sm dark:border-[#2c2817]">
              {step === 3 || orderPlaced ? (
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500 dark:text-[#cfbd78]">Payment</span>
                  <span>{orderPlaced ? placedOrder?.paymentLabel : paymentLabel}</span>
                </div>
              ) : null}
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
              <div className="flex items-center justify-between border-t border-neutral-200 pt-3 text-base font-semibold dark:border-[#2c2817]">
                <span>{t("totalPayable")}</span>
                <span>{formatCurrency(orderPlaced ? placedOrder?.total ?? total : total)}</span>
              </div>
            </div>

            {!orderPlaced ? (
                <button
                  type="button"
                  className="mt-5 w-full rounded-2xl bg-[#111827] px-4 py-3 text-sm font-semibold text-white dark:bg-[#f0d34f] dark:text-[#090909]"
                  onClick={step === 2 ? continueToPayment : placeOrder}
                  disabled={checkoutItems.length === 0}
                >
                {step === 2 ? t("continueToPayment") : t("placeOrder")}
              </button>
            ) : null}
          </aside>
        </div>
      </section>
    </main>
  );
}
