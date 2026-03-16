"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
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
import { api, asNumber, unwrapObject } from "../../lib/api";
import {
  createAddress,
  fetchMyAddresses,
  type Address,
  type CreateAddressInput,
} from "../lib/address-api";
import {
  fetchCountries,
  fetchLocationSchema,
  fetchLocationChildren,
  type LocationCountry,
  type LocationItem,
  type LocationSchema,
} from "../lib/location-options";
import { useStoreSettings } from "../lib/store-settings";
import { requestProductsRefresh } from "../lib/use-live-products";

// ─── helpers re-exported from api.ts that the old file used ──────────────────
import { asString, unwrapList } from "../../lib/api";

type CallingCodeItem = {
  country_code: string;
  country_name: string;
  calling_code: string;
};

const isoToFlagEmoji = (iso: string) => {
  const code = iso.trim().toUpperCase();
  if (code.length !== 2) return "";
  const A = 0x1f1e6;
  const chars = [...code].map((c) => A + (c.charCodeAt(0) - 65));
  return String.fromCodePoint(chars[0], chars[1]);
};

const normalizeDigits = (value: string) => value.replace(/[^\d+]/g, "");

function replaceCallingCode(
  phone: string,
  nextCode: string,
  allCodes: string[],
) {
  const currentRaw = String(phone ?? "");
  const currentDigits = normalizeDigits(currentRaw).replace(/\s/g, "");
  const nextDigitsCode = normalizeDigits(nextCode).replace(/\s/g, "");

  const normalizedCodes = [...allCodes]
    .map((c) => normalizeDigits(c).replace(/\s/g, ""))
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  const existingPrefix =
    currentDigits.startsWith("+")
      ? (normalizedCodes.find((cc) => currentDigits.startsWith(cc)) ?? null)
      : null;

  const restDigits = existingPrefix
    ? currentDigits.slice(existingPrefix.length)
    : currentDigits.replace(/^\+/, "");

  const rest = restDigits.replace(/^\s+/, "");
  return `${nextDigitsCode}${rest ? " " + rest : ""}`.trimEnd() + " ";
}

// ─── PhoneNumberPicker (unchanged from original) ─────────────────────────────
const PhoneNumberPicker = (props: {
  value: string;
  onChange: (next: string) => void;
  selectedCountryCode: string; // now uses ISO code, not country name
  className?: string;
  placeholder?: string;
}) => {
  const { value, onChange, selectedCountryCode, className, placeholder } =
    props;
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<CallingCodeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCode, setSelectedCode] = useState<CallingCodeItem | null>(
    null,
  );

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const response = await api("/api/locations/calling-codes");
        const record = unwrapObject(response);
        const list = unwrapList(record?.items ?? response)
          .map((raw) => unwrapObject(raw))
          .filter((raw): raw is Record<string, unknown> => raw !== null)
          .map(
            (raw): CallingCodeItem => ({
              country_code: asString(raw.country_code || raw.countryCode),
              country_name: asString(raw.country_name || raw.countryName),
              calling_code: asString(raw.calling_code || raw.callingCode),
            }),
          )
          .filter((item) => item.country_code && item.calling_code);
        if (!cancelled) setItems(list);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */

  // Auto-select calling code when country ISO changes
  useEffect(() => {
    if (!items.length || !selectedCountryCode) return;
    const match = items.find(
      (item) =>
        item.country_code.toUpperCase() === selectedCountryCode.toUpperCase(),
    );
    if (!match) return;

    // Only update state/value when needed to avoid infinite render loops.
    setSelectedCode((prev) =>
      prev?.country_code === match.country_code ? prev : match,
    );

    const next = replaceCallingCode(
      valueRef.current,
      match.calling_code,
      items.map((i) => i.calling_code),
    );
    if (next !== valueRef.current) {
      onChangeRef.current(next);
    }
  }, [items, selectedCountryCode]);

  useEffect(() => {
    if (selectedCode) return;
    const digits = normalizeDigits(value);
    const found = items.find((item) =>
      digits.startsWith(item.calling_code.replace(/\s/g, "")),
    );
    if (found) setSelectedCode(found);
  }, [items, selectedCode, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const name = item.country_name.toLowerCase();
      const code = item.calling_code.toLowerCase();
      const iso = item.country_code.toLowerCase();
      return name.includes(q) || code.includes(q) || iso.includes(q);
    });
  }, [items, query]);

  const displayFlag = selectedCode
    ? isoToFlagEmoji(selectedCode.country_code)
    : "🌐";
  const displayCode = selectedCode?.calling_code ?? "+";

  return (
    <div className="relative md:col-span-2">
      <div className="flex overflow-hidden rounded-2xl border border-neutral-300 dark:border-[#d6b736]">
        <button
          type="button"
          className="flex shrink-0 items-center gap-2 border-r border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-900 dark:border-[#2c2817] dark:bg-[#050505] dark:text-[#f0d34f]"
          onClick={() => setOpen((prev) => !prev)}
        >
          <span className="text-base leading-none">{displayFlag}</span>
          <span className="text-xs opacity-80">{displayCode}</span>
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            className="h-4 w-4 opacity-70"
            fill="currentColor"
          >
            <path d="M5.5 7.5l4.5 5 4.5-5H5.5z" />
          </svg>
        </button>
        <input
          type="tel"
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={
            className ??
            "h-12 w-full bg-white px-4 text-neutral-900 outline-none dark:bg-[#050505] dark:text-[#f0d34f] dark:placeholder:text-[#8e7727]"
          }
        />
      </div>

      {open ? (
        <div className="absolute z-[60] mt-2 w-full overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-lg dark:border-[#2c2817] dark:bg-[#0b0b0a]">
          <div className="border-b border-neutral-200 p-3 dark:border-[#2c2817]">
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search for countries"
              className="h-10 w-full rounded-xl border border-neutral-300 px-3 text-sm outline-none dark:border-[#2c2817] dark:bg-[#050505] dark:text-[#f0d34f] dark:placeholder:text-[#8e7727]"
            />
          </div>
          <div className="max-h-64 overflow-auto p-2">
            {loading ? (
              <div className="px-3 py-2 text-sm text-neutral-500 dark:text-[#cfbd78]">
                Loading…
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-3 py-2 text-sm text-neutral-500 dark:text-[#cfbd78]">
                No results
              </div>
            ) : (
              filtered.map((item) => {
                const active = selectedCode?.country_code === item.country_code;
                return (
                  <button
                    key={item.country_code}
                    type="button"
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${
                      active
                        ? "bg-neutral-100 dark:bg-[#11110f]"
                        : "hover:bg-neutral-50 dark:hover:bg-[#11110f]"
                    }`}
                    onClick={() => {
                      setSelectedCode(item);
                      const digits = normalizeDigits(value);
                      const rest = digits.startsWith("+")
                        ? digits.replace(/^\+\d+\s?/, "")
                        : digits.replace(/^\d+/, "");
                      onChange(`${item.calling_code} ${rest}`.trimEnd() + " ");
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-base">
                        {isoToFlagEmoji(item.country_code)}
                      </span>
                      <span className="font-medium text-neutral-900 dark:text-[#f0d34f]">
                        {item.country_name}
                      </span>
                      <span className="text-neutral-500 dark:text-[#cfbd78]">
                        ({item.calling_code})
                      </span>
                    </span>
                    {active ? (
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 20 20"
                        className="h-4 w-4"
                        fill="currentColor"
                      >
                        <path d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.4 7.4a1 1 0 0 1-1.4 0L3.3 9.5a1 1 0 1 1 1.4-1.4l3.1 3.1 6.7-6.7a1 1 0 0 1 1.2-.2z" />
                      </svg>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

// ─── LocationSelect ───────────────────────────────────────────────────────────
// A generic dropdown for any location level, shows a spinner while loading.
const LocationSelect = (props: {
  value: string; // selected item ID
  onChange: (id: string, name: string) => void;
  options: LocationItem[];
  loading: boolean;
  placeholder: string;
  disabled?: boolean;
  className?: string;
  placeholderClassName?: string;
}) => {
  const {
    value,
    onChange,
    options,
    loading,
    placeholder,
    disabled,
    className,
    placeholderClassName,
  } = props;

  if (loading) {
    return (
      <div
        className={`flex h-12 items-center rounded-2xl border border-neutral-300 px-4 text-sm text-neutral-400 dark:border-[#d6b736] dark:bg-[#050505] dark:text-[#8e7727] ${disabled ? "opacity-50" : ""}`}
      >
        <svg
          className="mr-2 h-4 w-4 animate-spin"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
          />
        </svg>
        Loading…
      </div>
    );
  }

  const hasValue = !!value;

  return (
    <select
      value={value}
      onChange={(e) => {
        const selected = options.find((o) => o.id === e.target.value);
        onChange(e.target.value, selected?.name ?? "");
      }}
      disabled={disabled}
      className={hasValue ? className : placeholderClassName}
    >
      <option value="" disabled hidden>
        {placeholder}
      </option>
      {options.length === 0 ? (
        <option value="" disabled>
          No options
        </option>
      ) : null}
      {options.map((opt) => (
        <option key={opt.id} value={opt.id}>
          {opt.name}
        </option>
      ))}
    </select>
  );
};

// ─── Types ────────────────────────────────────────────────────────────────────

const paymentOptions = ["card", "ewallet", "cod"] as const;
const ewalletOptions = ["GCash", "PayPal", "Maya"] as const;

type ShippingForm = {
  fullName: string;
  email: string;
  phoneNumber: string;
  address: string;
  // IDs (sent to backend)
  country_id: string; // ISO code, e.g. "PH"
  region_id: string;
  province_id: string;
  city_id: string;
  district_id: string;
  // Display names (shown in UI / order summary)
  country: string;
  region: string;
  province: string;
  city: string;
  barangay: string; // kept for display; maps to district in backend
  postalCode: string;
};

const initialShipping: ShippingForm = {
  fullName: "",
  email: "",
  phoneNumber: "",
  address: "",
  country_id: "",
  region_id: "",
  province_id: "",
  city_id: "",
  district_id: "",
  country: "",
  region: "",
  province: "",
  city: "",
  barangay: "",
  postalCode: "",
};

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CheckoutPage() {
  const router = useRouter();
  const cart = useSyncExternalStore(
    subscribeCart,
    readCart,
    getCartServerSnapshot,
  );
  const selectedCartItemIds = useSyncExternalStore(
    subscribeCart,
    readSelectedCartItemIds,
    getSelectedCartServerSnapshot,
  );
  const { t, currency, formatCurrency } = useStoreSettings();

  const usdToPhpRate = useMemo(() => {
    const json =
      process.env.NEXT_PUBLIC_FX_RATES_USD_JSON ??
      process.env.FX_RATES_USD_JSON ??
      "";
    if (json) {
      try {
        const parsed = JSON.parse(json) as unknown;
        if (
          parsed &&
          typeof parsed === "object" &&
          "PHP" in parsed &&
          typeof (parsed as Record<string, unknown>).PHP === "number" &&
          Number.isFinite((parsed as Record<string, unknown>).PHP)
        ) {
          return (parsed as Record<string, number>).PHP;
        }
      } catch {
        // ignore invalid JSON and fall back to scalar rate
      }
    }

    const scalar =
      process.env.NEXT_PUBLIC_USD_TO_PHP_RATE ?? process.env.USD_TO_PHP_RATE;
    const rate = scalar ? Number(scalar) : Number.NaN;
    return Number.isFinite(rate) && rate > 0 ? rate : null;
  }, []);

  const formatUsd = (value: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  const formatPhp = (value: number) =>
    new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);

  const formatDisplay = (usdValue: number) => {
    if (currency === "USD") return formatUsd(usdValue);
    if (currency === "PHP" && usdToPhpRate != null) {
      return formatPhp(Math.round(usdValue * usdToPhpRate * 100) / 100);
    }
    return formatCurrency(usdValue);
  };

  const steps = [
    { id: 1, label: t("shoppingCart") },
    { id: 2, label: t("shippingDetails") },
    { id: 3, label: t("paymentOption") },
  ];

  const [step, setStep] = useState<2 | 3>(2);
  const [shipping, setShipping] = useState<ShippingForm>(initialShipping);
  const [payment, setPayment] =
    useState<(typeof paymentOptions)[number]>("card");
  const [ewallet, setEwallet] =
    useState<(typeof ewalletOptions)[number]>("GCash");
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(true);
  const [useSavedAddress, setUseSavedAddress] = useState(true);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(
    null,
  );
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<{
    paymentLabel: string;
    usdTotal: number;
    subtotalUsd: number;
    shippingFeeUsd: number;
    taxAmountUsd: number;
    phpEstimate: number | null;
    exchangeRate: number | null;
  } | null>(null);
  const [error, setError] = useState("");
  const [placingOrder, setPlacingOrder] = useState(false);
  const [placingStage, setPlacingStage] = useState<
    "payment" | "confirm" | "email"
  >("payment");
  const [placingComplete, setPlacingComplete] = useState(false);
  const placingStartRef = useRef<number>(0);

  // ── Location state ──────────────────────────────────────────────────────────
  const [countries, setCountries] = useState<LocationCountry[]>([]);
  const [countriesLoading, setCountriesLoading] = useState(false);
  const [schema, setSchema] = useState<LocationSchema | null>(null);

  const [regions, setRegions] = useState<LocationItem[]>([]);
  const [regionsLoading, setRegionsLoading] = useState(false);
  const [provinces, setProvinces] = useState<LocationItem[]>([]);
  const [provincesLoading, setProvincesLoading] = useState(false);
  const [cities, setCities] = useState<LocationItem[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [districts, setDistricts] = useState<LocationItem[]>([]);
  const [districtsLoading, setDistrictsLoading] = useState(false);

  // Derived: which levels does this country's schema require/show?
  const schemaLevelTypes = useMemo(
    () => new Set(schema?.levels.map((l) => l.type) ?? []),
    [schema],
  );
  const showRegion = schemaLevelTypes.has("region") || regions.length > 0;
  const showProvince = schemaLevelTypes.has("province") || provinces.length > 0;
  const showCity = schemaLevelTypes.has("city") || cities.length > 0;
  const showDistrict = schemaLevelTypes.has("district") || districts.length > 0;

  // ── Load countries once ─────────────────────────────────────────────────────
  useEffect(() => {
    setCountriesLoading(true);
    fetchCountries()
      .then(setCountries)
      .finally(() => setCountriesLoading(false));
  }, []);

  // ── When country changes → load schema + regions ────────────────────────────
  useEffect(() => {
    if (!shipping.country_id) return;
    let cancelled = false;

    const load = async () => {
      setRegionsLoading(true);
      setSchema(null);
      setProvinces([]);
      setCities([]);
      setDistricts([]);

      const [schemaResult, regionResult] = await Promise.all([
        fetchLocationSchema(shipping.country_id),
        fetchLocationChildren(shipping.country_id, "region"),
      ]);

      if (cancelled) return;
      setSchema(schemaResult);
      setRegions(regionResult);
      setRegionsLoading(false);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [shipping.country_id]);

  // ── When region changes → load provinces ───────────────────────────────────
  useEffect(() => {
    if (!shipping.region_id) return;
    let cancelled = false;
    setProvincesLoading(true);
    setCities([]);
    setDistricts([]);
    fetchLocationChildren(shipping.region_id, "province").then((items) => {
      if (cancelled) return;
      setProvinces(items);
      setProvincesLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [shipping.region_id]);

  // ── When province changes → load cities ────────────────────────────────────
  useEffect(() => {
    if (!shipping.province_id) return;
    let cancelled = false;
    setCitiesLoading(true);
    setDistricts([]);
    // Try fetching cities under the province; if none, try under region
    fetchLocationChildren(shipping.province_id, "city").then(async (items) => {
      if (cancelled) return;
      if (items.length === 0 && shipping.region_id) {
        const fallback = await fetchLocationChildren(
          shipping.region_id,
          "city",
        );
        if (!cancelled) {
          setCities(fallback);
          setCitiesLoading(false);
        }
      } else {
        setCities(items);
        setCitiesLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [shipping.province_id, shipping.region_id]);

  // ── When city changes → load districts ────────────────────────────────────
  useEffect(() => {
    if (!shipping.city_id) return;
    let cancelled = false;
    setDistrictsLoading(true);
    fetchLocationChildren(shipping.city_id, "district").then((items) => {
      if (cancelled) return;
      setDistricts(items);
      setDistrictsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [shipping.city_id]);

  /* eslint-enable react-hooks/set-state-in-effect */

  // ── Cart ────────────────────────────────────────────────────────────────────
  const checkoutItems = useMemo(
    () => cart.filter((item) => selectedCartItemIds.includes(item.id)),
    [cart, selectedCartItemIds],
  );
  const cartCount = useMemo(() => getCartCount(cart), [cart]);
  const subtotal = useMemo(
    () => getCartSubtotal(checkoutItems),
    [checkoutItems],
  );
  const shippingFee = checkoutItems.length > 0 ? 12 : 0;
  const taxAmount = Number((subtotal * 0.08).toFixed(2));
  const total = subtotal + shippingFee + taxAmount;

  const selectedAddress =
    addresses.find((a) => a.id === selectedAddressId) ?? null;

  // ── Load saved addresses ────────────────────────────────────────────────────
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
        if (!cancelled) setAddressesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const updateField = (field: keyof ShippingForm, value: string) =>
    setShipping((prev) => ({ ...prev, [field]: value }));

  const selectClassName =
    "h-12 rounded-2xl border border-neutral-300 px-4 dark:border-[#d6b736] dark:bg-[#050505] dark:text-[#f0d34f]";
  const placeholderSelectClassName = `${selectClassName} text-neutral-500 dark:text-[#8e7727]`;

  const applySavedAddress = (address: Address) => {
    setSelectedAddressId(address.id);
    setUseSavedAddress(true);
    setSchema(null);
    setRegions([]);
    setProvinces([]);
    setCities([]);
    setDistricts([]);
    // For saved addresses we keep the display fields as-is; IDs will be empty
    // (backend already has them stored) — the order uses address_id.
    setShipping({
      fullName: address.full_name,
      email: address.email,
      phoneNumber: address.phone ?? "",
      address: address.street,
      country_id: "",
      region_id: "",
      province_id: "",
      city_id: "",
      district_id: "",
      country: address.country,
      region: address.region,
      province: address.province,
      city: address.city,
      barangay: address.barangay,
      postalCode: address.zip_code,
    });
  };

  // ── Validation ──────────────────────────────────────────────────────────────
  const continueToPayment = () => {
    if (useSavedAddress && selectedAddress) {
      setError("");
      applySavedAddress(selectedAddress);
      setStep(3);
      return;
    }

    const missing: string[] = [];
    if (!shipping.fullName.trim()) missing.push("full name");
    if (!shipping.email.trim()) missing.push("email");
    if (!shipping.phoneNumber.trim()) missing.push("phone number");
    if (!shipping.address.trim()) missing.push("street address");
    if (!shipping.postalCode.trim()) missing.push("postal code");
    if (!shipping.country_id) missing.push("country");
    const requiredTypes = new Set(
      (schema?.levels ?? []).filter((l) => l.required).map((l) => l.type),
    );

    if (requiredTypes.has("region") && !shipping.region_id)
      missing.push("region");
    if (requiredTypes.has("province") && !shipping.province_id)
      missing.push("province");
    if (requiredTypes.has("city") && !shipping.city_id)
      missing.push("city");
    if (requiredTypes.has("district") && !shipping.district_id)
      missing.push("district / barangay");

    if (missing.length > 0) {
      setError(`Please fill in: ${missing.join(", ")}.`);
      return;
    }

    setError("");
    setStep(3);
  };

  // ── Payment label ───────────────────────────────────────────────────────────
  const paymentLabel =
    payment === "card"
      ? t("creditDebitCard")
      : payment === "ewallet"
        ? `E-Wallet${ewallet ? ` • ${ewallet}` : ""}`
        : t("cashOnDelivery");

  // ── Place order ─────────────────────────────────────────────────────────────
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

      // Build address payload using IDs + snapshot names
      const addressPayload: CreateAddressInput = {
        full_name: shipping.fullName.trim(),
        email: shipping.email.trim(),
        phone: shipping.phoneNumber.trim(),
        street: shipping.address.trim(),
        zip_code: shipping.postalCode.trim(),
        country_code: shipping.country_id,
        region_id: shipping.region_id || undefined,
        province_id: shipping.province_id || undefined,
        city_id: shipping.city_id || undefined,
        district_id: shipping.district_id || undefined,
      };

      type WithAddressId = {
        payment_method: string;
        status?: string;
        address_id: number;
        courier?: string;
        shipping_fee?: number;
        tax_amount?: number;
        currency?: string;
        display_currency?: string;
        exchange_rate?: number;
        estimated_php?: number;
      };
      type WithAddressInline = Omit<WithAddressId, "address_id"> & {
        address: CreateAddressInput;
      };

      let payload: WithAddressId | WithAddressInline;
      const estimatedPhpForEmail =
        usdToPhpRate != null
          ? (subtotal + shippingFee + taxAmount) * usdToPhpRate
          : null;

      if (useSavedAddress && selectedAddress) {
        payload = {
          payment_method,
          status: orderStatus,
          address_id: selectedAddress.id,
          courier: "Warehouse A",
          shipping_fee: Number(shippingFee),
          tax_amount: Number(taxAmount),
          currency: "USD",
          display_currency: currency,
          exchange_rate: usdToPhpRate ?? undefined,
          estimated_php:
            estimatedPhpForEmail != null
              ? Math.round(estimatedPhpForEmail * 100) / 100
              : undefined,
        };
      } else {
        let createdAddress: Address | null = null;
        try {
          createdAddress = await createAddress(addressPayload);
          if (createdAddress) {
            setAddresses((prev) => [
              createdAddress!,
              ...prev.filter((i) => i.id !== createdAddress!.id),
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
              shipping_fee: Number(shippingFee),
              tax_amount: Number(taxAmount),
              currency: "USD",
              display_currency: currency,
              exchange_rate: usdToPhpRate ?? undefined,
              estimated_php:
                estimatedPhpForEmail != null
                  ? Math.round(estimatedPhpForEmail * 100) / 100
                  : undefined,
            }
          : {
              payment_method,
              status: orderStatus,
              address: addressPayload,
              courier: "Warehouse A",
              shipping_fee: Number(shippingFee),
              tax_amount: Number(taxAmount),
              currency: "USD",
              display_currency: currency,
              exchange_rate: usdToPhpRate ?? undefined,
              estimated_php:
                estimatedPhpForEmail != null
                  ? Math.round(estimatedPhpForEmail * 100) / 100
                  : undefined,
            };
      }

      const checkoutResponse = await api("/api/orders/checkout", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const checkoutOrder = unwrapObject(checkoutResponse);
      const usdTotalRaw = checkoutOrder
        ? asNumber(
            checkoutOrder.total_usd ??
              checkoutOrder.total_amount ??
              checkoutOrder.totalAmount,
            Number.NaN,
          )
        : Number.NaN;
      const usdTotal = Number.isFinite(usdTotalRaw) ? usdTotalRaw : total;
      const subtotalUsdRaw = checkoutOrder
        ? asNumber(
            checkoutOrder.subtotal_usd ??
              checkoutOrder.subtotal_amount ??
              checkoutOrder.subtotal ??
              checkoutOrder.subtotalAmount,
            Number.NaN,
          )
        : Number.NaN;
      const subtotalUsd = Number.isFinite(subtotalUsdRaw)
        ? subtotalUsdRaw
        : subtotal;
      const shippingFeeUsdRaw = checkoutOrder
        ? asNumber(
            checkoutOrder.shipping_fee ?? checkoutOrder.shippingFee,
            Number.NaN,
          )
        : Number.NaN;
      const shippingFeeUsd = Number.isFinite(shippingFeeUsdRaw)
        ? shippingFeeUsdRaw
        : shippingFee;
      const taxAmountUsdRaw = checkoutOrder
        ? asNumber(
            checkoutOrder.tax_amount ?? checkoutOrder.taxAmount,
            Number.NaN,
          )
        : Number.NaN;
      const taxAmountUsd = Number.isFinite(taxAmountUsdRaw)
        ? taxAmountUsdRaw
        : taxAmount;
      const estimatedPhpRaw = checkoutOrder
        ? asNumber(
            checkoutOrder.estimated_php ?? checkoutOrder.estimatedPhp,
            Number.NaN,
          )
        : Number.NaN;
      const phpEstimate = Number.isFinite(estimatedPhpRaw)
        ? estimatedPhpRaw
        : null;
      const exchangeRateRaw = checkoutOrder
        ? asNumber(
            checkoutOrder.exchange_rate ?? checkoutOrder.exchangeRate,
            Number.NaN,
          )
        : Number.NaN;
      const exchangeRate = Number.isFinite(exchangeRateRaw)
        ? exchangeRateRaw
        : null;

      const elapsed = Date.now() - placingStartRef.current;
      if (elapsed < 1500)
        await new Promise((r) => setTimeout(r, 1500 - elapsed));
      setPlacingStage("confirm");
      await new Promise((r) => setTimeout(r, 900));

      const featuredItem = checkoutItems[0] ?? null;
      notifyStore({
        message: `You placed an order worth ${formatUsd(usdTotal)}.`,
        productId: featuredItem?.productId,
        image: featuredItem?.image ?? "",
      });

      setPlacingStage("email");
      await new Promise((r) => setTimeout(r, 1200));

      setError("");
      setPlacedOrder({
        paymentLabel,
        usdTotal,
        subtotalUsd,
        shippingFeeUsd,
        taxAmountUsd,
        phpEstimate,
        exchangeRate,
      });
      writeSelectedCartItemIds([]);
      await refreshCart();
      requestProductsRefresh();
      setOrderPlaced(true);
      setPlacingComplete(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to place order.");
      setPlacingOrder(false);
      setPlacingComplete(false);
    }
  };

  // ── Address display line ────────────────────────────────────────────────────
  const addressLine =
    useSavedAddress && selectedAddress
      ? `${selectedAddress.street}, ${[selectedAddress.barangay, selectedAddress.city, selectedAddress.province, selectedAddress.region, selectedAddress.country, selectedAddress.zip_code].filter(Boolean).join(", ")}`
      : `${shipping.address}, ${[shipping.barangay, shipping.city, shipping.province, shipping.region, shipping.country, shipping.postalCode].filter(Boolean).join(", ")}`;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-[#f7f7f7] text-[#111] transition-colors dark:bg-[#060606] dark:bg-[radial-gradient(circle_at_top,rgba(118,100,26,0.16),transparent_16%),linear-gradient(180deg,#050505_0%,#090909_38%,#0b0b0a_100%)] dark:text-[#f0d34f]">
      <StoreHeader cartCount={cartCount} />

      {/* ── Placing-order overlay ── */}
      {placingOrder ? (
        <div className="fixed inset-0 z-[120] grid place-items-center bg-white/80 px-6 backdrop-blur-sm dark:bg-black/60">
          <div className="w-full max-w-[420px] rounded-[28px] border border-neutral-200 bg-white p-10 text-center shadow-[0_24px_80px_rgba(15,23,42,0.22)] dark:border-[#2c2817] dark:bg-[#090909]">
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-full border border-neutral-200 dark:border-[#2c2817]">
              <div className="relative grid h-12 w-12 place-items-center">
                <div className="absolute inset-0 rounded-full border-4 border-neutral-200 dark:border-[#2c2817]" />
                {!placingComplete ? (
                  <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-[#111827] dark:border-t-[#f1d04b]" />
                ) : null}
                <div
                  className={`grid h-8 w-8 place-items-center rounded-full shadow-sm ${placingComplete ? "bg-emerald-500 text-white" : "bg-neutral-200 text-neutral-700 dark:bg-[#2c2817] dark:text-[#f1d04b]"}`}
                >
                  {placingComplete ? (
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 20 20"
                      className="h-4 w-4"
                      fill="none"
                    >
                      <path
                        d="M6 10.5L8.7 13.2L14 7.8"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
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
                  ? "Securing your transaction. Please don't close this page."
                  : placingStage === "confirm"
                    ? "Creating your order and reserving stock."
                    : `Preparing an email confirmation for ${shipping.email || "your email"}.`}
            </p>
            <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-[#2c2817]">
              <div
                className={`h-full rounded-full ${placingComplete ? "bg-emerald-500" : "bg-[#111827] dark:bg-[#f1d04b]"}`}
                style={{
                  width: placingComplete
                    ? "100%"
                    : placingStage === "payment"
                      ? "35%"
                      : placingStage === "confirm"
                        ? "70%"
                        : "90%",
                }}
              />
            </div>
            <div className="mt-6 space-y-2 text-left text-sm">
              {(["payment", "confirm", "email"] as const).map((stage, idx) => {
                const labels = ["Payment", "Order confirmation", "Email"];
                const isCurrent = placingStage === stage && !placingComplete;
                const isDone =
                  placingComplete ||
                  (placingStage === "confirm" && stage === "payment") ||
                  (placingStage === "email" &&
                    (stage === "payment" || stage === "confirm"));
                return (
                  <div
                    key={stage}
                    className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${isCurrent ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-[#0b1b12] dark:text-emerald-100" : "border-neutral-200 text-neutral-500 dark:border-[#2c2817] dark:text-[#cfbd78]"}`}
                  >
                    <span>{labels[idx]}</span>
                    <span className="text-xs">
                      {isCurrent ? "In progress" : isDone ? "Done" : "Waiting"}
                    </span>
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              disabled={!placingComplete}
              onClick={() => setPlacingOrder(false)}
              className="mt-8 w-full rounded-2xl bg-[#111827] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#f1d04b] dark:text-[#090909]"
            >
              Continue
            </button>
          </div>
        </div>
      ) : null}

      <section className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">
        {/* Step indicators */}
        <div className="mb-8 flex flex-wrap items-center justify-center gap-4">
          {steps.map((item, index) => (
            <div key={item.id} className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <span
                  className={`grid h-8 w-8 place-items-center rounded-full text-sm font-semibold ${item.id <= step ? "bg-[#111827] text-white dark:bg-[#f0d34f] dark:text-[#090909]" : "bg-neutral-100 text-neutral-500 dark:bg-[#141412] dark:text-[#cfbd78]"}`}
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
          {/* ── Left panel ── */}
          <div className="rounded-[28px] border border-neutral-200 bg-white p-6 shadow-sm dark:border-[#2c2817] dark:bg-[#070707] dark:shadow-[0_0_0_1px_rgba(214,183,54,0.1)]">
            {orderPlaced ? (
              <div className="space-y-4 text-center">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-neutral-500 dark:text-[#cfbd78]">
                  Order Confirmed
                </p>
                <h1 className="text-4xl font-semibold">
                  {t("yourOrderPlaced")}
                </h1>
                <p className="text-sm text-neutral-500 dark:text-[#cfbd78]">
                  {t("shippingTo")}: {addressLine}
                </p>
                <p className="text-sm text-neutral-500 dark:text-[#cfbd78]">
                  Payment: {placedOrder?.paymentLabel ?? paymentLabel}
                </p>
                <p className="text-sm text-neutral-500 dark:text-[#cfbd78]">
                  Total: {formatUsd(placedOrder?.usdTotal ?? total)}
                </p>
                {placedOrder?.phpEstimate != null ? (
                  <p className="text-sm text-neutral-500 dark:text-[#cfbd78]">
                    Estimated: {formatPhp(placedOrder.phpEstimate)}
                  </p>
                ) : null}
                {placedOrder?.exchangeRate != null ? (
                  <p className="text-sm text-neutral-500 dark:text-[#cfbd78]">
                    Rate: 1 USD = {placedOrder.exchangeRate} PHP
                  </p>
                ) : null}
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
                              if (selectedAddress)
                                applySavedAddress(selectedAddress);
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
                                className={`w-full rounded-[24px] border p-4 text-left transition ${selectedAddressId === address.id ? "border-[#111827] bg-neutral-50 dark:border-[#f0d34f] dark:bg-[#11110f]" : "border-neutral-200 dark:border-[#2c2817] dark:bg-[#0d0d0c]"}`}
                                onClick={() => applySavedAddress(address)}
                              >
                                <p className="text-lg font-semibold">
                                  {address.full_name}
                                </p>
                                <p className="mt-2 text-sm text-neutral-500 dark:text-[#cfbd78]">
                                  {address.street}
                                </p>
                                <p className="text-sm text-neutral-500 dark:text-[#cfbd78]">
                                  {[
                                    address.barangay,
                                    address.city,
                                    address.province,
                                    address.region,
                                    address.country,
                                    address.zip_code,
                                  ]
                                    .filter(Boolean)
                                    .join(", ")}
                                </p>
                                <p className="mt-1 text-sm text-neutral-500 dark:text-[#cfbd78]">
                                  {address.email}
                                </p>
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {!useSavedAddress || addresses.length === 0 ? (
                      <div className="grid gap-4 md:grid-cols-2">
                        {/* Personal info */}
                        <input
                          type="text"
                          placeholder={t("fullName")}
                          value={shipping.fullName}
                          onChange={(e) =>
                            updateField("fullName", e.target.value)
                          }
                          className="h-12 rounded-2xl border border-neutral-300 px-4 dark:border-[#d6b736] dark:bg-[#050505] dark:text-[#f0d34f] dark:placeholder:text-[#8e7727]"
                        />
                        <input
                          type="email"
                          placeholder={t("email")}
                          value={shipping.email}
                          onChange={(e) => updateField("email", e.target.value)}
                          className="h-12 rounded-2xl border border-neutral-300 px-4 dark:border-[#d6b736] dark:bg-[#050505] dark:text-[#f0d34f] dark:placeholder:text-[#8e7727]"
                        />

                        <PhoneNumberPicker
                          placeholder={t("phoneNumber")}
                          value={shipping.phoneNumber}
                          selectedCountryCode={shipping.country_id}
                          onChange={(next) => updateField("phoneNumber", next)}
                          className="h-12 w-full bg-white px-4 text-neutral-900 outline-none dark:bg-[#050505] dark:text-[#f0d34f] dark:placeholder:text-[#8e7727]"
                        />

                        {/* ── Country ── */}
                        {countriesLoading ? (
                          <div className="flex h-12 items-center rounded-2xl border border-neutral-300 px-4 text-sm text-neutral-400 dark:border-[#d6b736] dark:bg-[#050505] dark:text-[#8e7727]">
                            <svg
                              className="mr-2 h-4 w-4 animate-spin"
                              viewBox="0 0 24 24"
                              fill="none"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              />
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                              />
                            </svg>
                            Loading countries…
                          </div>
                        ) : (
                          <select
                            value={shipping.country_id}
                            onChange={(e) => {
                              const selected = countries.find(
                                (c) => c.id === e.target.value,
                              );
                              setShipping((prev) => ({
                                ...prev,
                                country_id: e.target.value,
                                country: selected?.name ?? "",
                                region_id: "",
                                region: "",
                                province_id: "",
                                province: "",
                                city_id: "",
                                city: "",
                                district_id: "",
                                barangay: "",
                              }));
                            }}
                            className={
                              shipping.country_id
                                ? selectClassName
                                : placeholderSelectClassName
                            }
                          >
                            <option value="" disabled hidden>
                              {t("country")}
                            </option>
                            {countries.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        )}

                        {/* ── Region ── */}
                        {showRegion ? (
                          <LocationSelect
                            value={shipping.region_id}
                            onChange={(id, name) =>
                              setShipping((prev) => ({
                                ...prev,
                                region_id: id,
                                region: name,
                                province_id: "",
                                province: "",
                                city_id: "",
                                city: "",
                                district_id: "",
                                barangay: "",
                              }))
                            }
                            options={regions}
                            loading={regionsLoading}
                            placeholder={
                              schema?.levels.find((l) => l.type === "region")
                                ?.label ?? "Region"
                            }
                            disabled={!shipping.country_id}
                            className={selectClassName}
                            placeholderClassName={placeholderSelectClassName}
                          />
                        ) : null}

                        {/* ── Province ── */}
                        {showProvince ? (
                          <LocationSelect
                            value={shipping.province_id}
                            onChange={(id, name) =>
                              setShipping((prev) => ({
                                ...prev,
                                province_id: id,
                                province: name,
                                city_id: "",
                                city: "",
                                district_id: "",
                                barangay: "",
                              }))
                            }
                            options={provinces}
                            loading={provincesLoading}
                            placeholder={
                              schema?.levels.find((l) => l.type === "province")
                                ?.label ?? "Province"
                            }
                            disabled={!shipping.region_id}
                            className={selectClassName}
                            placeholderClassName={placeholderSelectClassName}
                          />
                        ) : null}

                        {/* ── City ── */}
                        {showCity ? (
                          <LocationSelect
                            value={shipping.city_id}
                            onChange={(id, name) =>
                              setShipping((prev) => ({
                                ...prev,
                                city_id: id,
                                city: name,
                                district_id: "",
                                barangay: "",
                              }))
                            }
                            options={cities}
                            loading={citiesLoading}
                            placeholder={
                              schema?.levels.find((l) => l.type === "city")
                                ?.label ?? t("city")
                            }
                            disabled={
                              showProvince
                                ? !shipping.province_id
                                : !shipping.region_id
                            }
                            className={selectClassName}
                            placeholderClassName={placeholderSelectClassName}
                          />
                        ) : null}

                        {/* ── District / Barangay ── */}
                        {showDistrict ? (
                          <LocationSelect
                            value={shipping.district_id}
                            onChange={(id, name) =>
                              setShipping((prev) => ({
                                ...prev,
                                district_id: id,
                                barangay: name,
                              }))
                            }
                            options={districts}
                            loading={districtsLoading}
                            placeholder={
                              schema?.levels.find((l) => l.type === "district")
                                ?.label ?? "Barangay"
                            }
                            disabled={!shipping.city_id}
                            className={selectClassName}
                            placeholderClassName={placeholderSelectClassName}
                          />
                        ) : null}

                        <input
                          type="text"
                          placeholder={t("postalCode")}
                          value={shipping.postalCode}
                          onChange={(e) =>
                            updateField("postalCode", e.target.value)
                          }
                          className="h-12 rounded-2xl border border-neutral-300 px-4 dark:border-[#d6b736] dark:bg-[#050505] dark:text-[#f0d34f] dark:placeholder:text-[#8e7727]"
                        />
                        <textarea
                          placeholder={t("streetAddress")}
                          value={shipping.address}
                          onChange={(e) =>
                            updateField("address", e.target.value)
                          }
                          className="min-h-[120px] rounded-2xl border border-neutral-300 px-4 py-3 md:col-span-2 dark:border-[#d6b736] dark:bg-[#050505] dark:text-[#f0d34f] dark:placeholder:text-[#8e7727]"
                        />
                      </div>
                    ) : null}
                  </div>
                ) : (
                  /* ── Step 3: Payment ── */
                  <div className="mt-6 space-y-4">
                    <div className="rounded-[24px] border border-neutral-200 p-4 dark:border-[#2c2817] dark:bg-[#0d0d0c]">
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500 dark:text-[#cfbd78]">
                        {t("selectedShippingAddress")}
                      </p>
                      <p className="mt-3 text-lg font-semibold">
                        {useSavedAddress && selectedAddress
                          ? selectedAddress.full_name
                          : shipping.fullName}
                      </p>
                      <p className="mt-2 text-sm text-neutral-500 dark:text-[#cfbd78]">
                        {addressLine}
                      </p>
                      <p className="mt-1 text-sm text-neutral-500 dark:text-[#cfbd78]">
                        {useSavedAddress && selectedAddress
                          ? (selectedAddress.phone ?? "")
                          : shipping.phoneNumber}
                      </p>
                      <p className="mt-1 text-sm text-neutral-500 dark:text-[#cfbd78]">
                        {useSavedAddress && selectedAddress
                          ? selectedAddress.email
                          : shipping.email}
                      </p>
                    </div>

                    <div className="space-y-3">
                      {paymentOptions.map((option) => (
                        <div
                          key={option}
                          className={`w-full rounded-[24px] border p-4 text-left transition ${payment === option ? "border-[#111827] bg-neutral-50 dark:border-[#f0d34f] dark:bg-[#11110f]" : "border-neutral-200 dark:border-[#2c2817] dark:bg-[#0d0d0c]"}`}
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
                                  className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${ewallet === wallet ? "border-[#111827] bg-[#111827] text-white dark:border-[#f0d34f] dark:bg-[#f0d34f] dark:text-[#090909]" : "border-neutral-300 text-neutral-700 dark:border-[#d6b736] dark:text-[#cfbd78]"}`}
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

                {error ? (
                  <p className="mt-4 text-sm text-rose-600">{error}</p>
                ) : null}
              </>
            )}
          </div>

          {/* ── Right panel: Order summary ── */}
          <aside className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm dark:border-[#2c2817] dark:bg-[#070707] dark:shadow-[0_0_0_1px_rgba(214,183,54,0.1)]">
            <h2 className="text-2xl font-semibold">{t("orderSummary")}</h2>
            <div className="mt-4 space-y-3 text-sm">
              {!orderPlaced
                ? checkoutItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-4"
                    >
                      <span className="text-neutral-500 dark:text-[#cfbd78]">
                        {item.name} {item.size ? `(${item.size}) ` : ""}x{" "}
                        {item.qty}
                      </span>
                      <span className="text-right">
                        {formatDisplay(item.price * item.qty)}
                      </span>
                    </div>
                  ))
                : null}
            </div>
            <div className="mt-5 space-y-3 border-t border-neutral-200 pt-4 text-sm dark:border-[#2c2817]">
              {step === 3 || orderPlaced ? (
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500 dark:text-[#cfbd78]">
                    Payment
                  </span>
                  <span>
                    {orderPlaced ? placedOrder?.paymentLabel : paymentLabel}
                  </span>
                </div>
              ) : null}
              <div className="flex items-center justify-between">
                <span className="text-neutral-500 dark:text-[#cfbd78]">
                  {t("subTotal")}
                </span>
                <span>
                  {formatDisplay(
                    orderPlaced
                      ? (placedOrder?.subtotalUsd ?? subtotal)
                      : subtotal,
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500 dark:text-[#cfbd78]">
                  {t("shipping")}
                </span>
                <span>
                  {formatDisplay(
                    orderPlaced
                      ? (placedOrder?.shippingFeeUsd ?? shippingFee)
                      : shippingFee,
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500 dark:text-[#cfbd78]">
                  {t("tax")}
                </span>
                <span>
                  {formatDisplay(
                    orderPlaced
                      ? (placedOrder?.taxAmountUsd ?? taxAmount)
                      : taxAmount,
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-neutral-200 pt-3 text-base font-semibold dark:border-[#2c2817]">
                <span>{t("totalPayable")}</span>
                <span className="text-right">
                  <span className="block">
                    {formatDisplay(
                      orderPlaced ? (placedOrder?.usdTotal ?? total) : total,
                    )}
                  </span>
                  {currency !== "USD" ? (
                    <span className="mt-0.5 block text-xs font-medium text-neutral-500 dark:text-[#cfbd78]">
                      Charged:{" "}
                      {formatUsd(
                        orderPlaced ? (placedOrder?.usdTotal ?? total) : total,
                      )}
                    </span>
                  ) : usdToPhpRate != null ? (
                    <span className="mt-0.5 block text-xs font-medium text-neutral-500 dark:text-[#cfbd78]">
                      (≈{" "}
                      {formatPhp(
                        Math.round(
                          ((orderPlaced
                            ? (placedOrder?.usdTotal ?? total)
                            : total) *
                            usdToPhpRate) *
                            100,
                        ) / 100,
                      )}
                      )
                    </span>
                  ) : null}
                </span>
              </div>
              {orderPlaced &&
              (placedOrder?.phpEstimate != null ||
                placedOrder?.exchangeRate != null) ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/20 dark:text-amber-100">
                  <p className="font-semibold">Charged in USD</p>
                  <p className="mt-2 text-sm font-semibold">
                    {formatUsd(placedOrder?.usdTotal ?? total)}
                  </p>
                  {placedOrder?.phpEstimate != null ? (
                    <p className="mt-1 text-sm font-semibold">
                      Estimated: {formatPhp(placedOrder.phpEstimate)}
                    </p>
                  ) : currency !== "USD" ? (
                    <p className="mt-1 text-sm font-semibold">
                      Estimated: {formatCurrency(placedOrder?.usdTotal ?? total)}
                    </p>
                  ) : usdToPhpRate != null ? (
                    <p className="mt-1 text-sm font-semibold">
                      Estimated:{" "}
                      {formatPhp(
                        Math.round(
                          ((placedOrder?.usdTotal ?? total) * usdToPhpRate) *
                            100,
                        ) / 100,
                      )}
                    </p>
                  ) : null}
                  {placedOrder?.exchangeRate != null ? (
                    <p className="mt-1 opacity-90">
                      Rate: 1 USD = {placedOrder.exchangeRate} PHP
                    </p>
                  ) : usdToPhpRate != null ? (
                    <p className="mt-1 opacity-90">
                      Rate: 1 USD = {usdToPhpRate} PHP
                    </p>
                  ) : null}
                </div>
              ) : null}
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
