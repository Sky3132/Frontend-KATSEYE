"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { USER_STORAGE_KEY, writeStoredUser } from "../../lib/auth";
import StoreHeader from "../components/store-header";
import {
  getCartCount,
  getCartServerSnapshot,
  readCart,
  subscribeCart,
} from "../lib/cart";
import {
  notificationImages,
  type AccountOrderStatus,
  type AccountSection,
} from "../lib/account-content";
import { cancelOrder, fetchOrders } from "../lib/orders-api";
import { products } from "../lib/products";
import { useStoreSettings } from "../lib/store-settings";
import {
  createAddress,
  deleteAddress,
  fetchMyAddresses,
  setDefaultAddress,
  type Address,
  type CreateAddressInput,
  updateAddress,
} from "../lib/address-api";
import {
  fetchCountries,
  fetchLocationSchema,
  fetchLocationChildren,
  type LocationCountry,
  type LocationItem,
  type LocationSchema,
} from "../lib/location-options";
import { api, asString, unwrapList, unwrapObject } from "../../lib/api";

type StoredUser = {
  id?: string;
  name?: string;
  email?: string;
  role?: string;
  avatar?: string;
};

type CallingCodeItem = {
  country_code: string;
  country_name: string;
  calling_code: string;
};

type MeProfile = {
  id?: string;
  role?: string;
  name?: string;
  email?: string;
  avatar?: string;
  full_name?: string;
  phone_e164?: string;
  fullName?: string;
  phoneE164?: string;
};

const isoToFlagEmoji = (iso: string) => {
  const code = iso.trim().toUpperCase();
  if (code.length !== 2) return "";
  const A = 0x1f1e6;
  const chars = [...code].map((c) => A + (c.charCodeAt(0) - 65));
  return String.fromCodePoint(chars[0], chars[1]);
};

const normalizeDigits = (value: string) => value.replace(/[^\d+]/g, "");

function replaceCallingCode(phone: string, nextCode: string, allCodes: string[]) {
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

const PhoneNumberPicker = (props: {
  value: string;
  onChange: (next: string) => void;
  selectedCountryCode: string; // ISO code e.g. "PH"
  className?: string;
  placeholder?: string;
}) => {
  const { value, onChange, selectedCountryCode, className, placeholder } =
    props;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<CallingCodeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCode, setSelectedCode] = useState<CallingCodeItem | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const response = await api("/locations/calling-codes");
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

  // Match by ISO code
  useEffect(() => {
    if (!items.length || !selectedCountryCode) return;
    const match = items.find(
      (item) =>
        item.country_code.toUpperCase() === selectedCountryCode.toUpperCase(),
    );
    if (!match) return;
    setSelectedCode(match);

    const next = replaceCallingCode(
      value,
      match.calling_code,
      items.map((i) => i.calling_code),
    );
    if (next !== value) onChange(next);
  }, [items, onChange, selectedCountryCode, value]);

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
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${active ? "bg-neutral-100 dark:bg-[#11110f]" : "hover:bg-neutral-50 dark:hover:bg-[#11110f]"}`}
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
const LocationSelect = (props: {
  value: string;
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

  return (
    <select
      value={value}
      onChange={(e) => {
        const selected = options.find((o) => o.id === e.target.value);
        onChange(e.target.value, selected?.name ?? "");
      }}
      disabled={disabled}
      className={value ? className : placeholderClassName}
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

type ShippingForm = {
  fullName: string;
  email: string;
  phoneNumber: string;
  address: string;
  // IDs
  country_id: string;
  region_id: string;
  province_id: string;
  city_id: string;
  district_id: string;
  // Display names
  country: string;
  region: string;
  province: string;
  city: string;
  barangay: string;
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

type NotificationItem = {
  id: string;
  message: string;
  createdAt: string;
  read: boolean;
  image?: string;
  productId?: string;
};

const EMPTY_USER: StoredUser = {};
const NOTIFICATIONS_KEY = "katseye_notifications";
const NOTIFICATIONS_EVENT = "katseye:notifications";
let cachedUserRaw: string | null = null;
let cachedUserSnapshot: StoredUser = EMPTY_USER;
let cachedNotificationsRaw: string | null = null;
let cachedNotificationsSnapshot: NotificationItem[] = [];

const readStoredUser = (): StoredUser => {
  if (typeof window === "undefined") return EMPTY_USER;
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    if (raw === cachedUserRaw) return cachedUserSnapshot;
    if (!raw) {
      cachedUserRaw = null;
      cachedUserSnapshot = EMPTY_USER;
      return cachedUserSnapshot;
    }
    cachedUserRaw = raw;
    cachedUserSnapshot = JSON.parse(raw) as StoredUser;
    return cachedUserSnapshot;
  } catch {
    cachedUserRaw = null;
    cachedUserSnapshot = EMPTY_USER;
    return cachedUserSnapshot;
  }
};

const readStoredNotifications = (): NotificationItem[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_KEY);
    if (raw === cachedNotificationsRaw) return cachedNotificationsSnapshot;
    if (!raw) {
      cachedNotificationsRaw = null;
      cachedNotificationsSnapshot = [];
      return cachedNotificationsSnapshot;
    }
    const parsed = JSON.parse(raw) as NotificationItem[];
    cachedNotificationsRaw = raw;
    cachedNotificationsSnapshot = Array.isArray(parsed) ? parsed : [];
    return cachedNotificationsSnapshot;
  } catch {
    cachedNotificationsRaw = null;
    cachedNotificationsSnapshot = [];
    return cachedNotificationsSnapshot;
  }
};

const subscribeUser = (callback: () => void) => {
  if (typeof window === "undefined") return () => {};
  const handleChange = () => callback();
  window.addEventListener("storage", handleChange);
  window.addEventListener(NOTIFICATIONS_EVENT, handleChange);
  return () => {
    window.removeEventListener("storage", handleChange);
    window.removeEventListener(NOTIFICATIONS_EVENT, handleChange);
  };
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AccountPage() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { formatCurrency, t } = useStoreSettings();
  const cart = useSyncExternalStore(
    subscribeCart,
    readCart,
    getCartServerSnapshot,
  );
  const user = useSyncExternalStore(
    subscribeUser,
    readStoredUser,
    () => EMPTY_USER,
  );
  const notifications = useSyncExternalStore(
    subscribeUser,
    readStoredNotifications,
    () => [],
  );

  const getNotificationTitle = (messageText: string) => {
    const normalized = String(messageText ?? "").toLowerCase();

    const isOrderCancelled =
      normalized.includes("order") &&
      (normalized.includes("cancelled") ||
        normalized.includes("canceled") ||
        normalized.includes("cancel"));
    if (isOrderCancelled) return "Order Cancelled";

    const isPaymentSuccessful =
      normalized.includes("payment successful") ||
      (normalized.includes("payment") && normalized.includes("successful")) ||
      normalized.includes("paid");
    if (isPaymentSuccessful) return "Payment Successful";

    const isOrderConfirmed =
      normalized.includes("order confirmed") ||
      normalized.includes("order received") ||
      normalized.includes("order placed") ||
      normalized.includes("you placed an order");
    if (isOrderConfirmed) return "Order Confirmed";

    const isReadyForCheckout =
      normalized.includes("ready for checkout") ||
      normalized.includes("ready to checkout") ||
      normalized.includes("left in your cart") ||
      (normalized.includes("checkout") && normalized.includes("ready"));
    if (isReadyForCheckout) return "Ready for Checkout";

    const isItemReserved =
      normalized.includes("item reserved") ||
      normalized.includes("reserved") ||
      normalized.includes("low stock") ||
      normalized.includes("almost sold out");
    if (isItemReserved) return "Item Reserved";

    const isBackInStock =
      normalized.includes("back in stock") ||
      (normalized.includes("back") && normalized.includes("stock")) ||
      normalized.includes("restocked");
    if (isBackInStock) return "Back in Stock";

    return "Order Updated";
  };
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(true);
  const [addressesError, setAddressesError] = useState("");
  const [editingAddressId, setEditingAddressId] = useState<
    number | "new" | null
  >(null);
  const [addressDefaultDraft, setAddressDefaultDraft] = useState(false);
  const [shipping, setShipping] = useState<ShippingForm>(initialShipping);

  const updateShippingField = (field: keyof ShippingForm, value: string) =>
    setShipping((prev) => ({ ...prev, [field]: value }));

  const [profileDraft, setProfileDraft] = useState({
    fullName: user.name ?? "Your name",
    name: user.name ?? "Your name",
    email: user.email ?? "yourname@gmail.com",
    phoneE164: "",
  });
  const [profileMessage, setProfileMessage] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const profileImage = user.avatar ?? "";

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = (await api("/api/users/me")) as unknown;
        const record = unwrapObject(response) ?? {};
        const me = (unwrapObject(record.user) ?? record) as MeProfile;
        if (cancelled) return;

        const nextName = asString(me.name || user.name, "Your name");
        const nextEmail = asString(
          me.email || user.email,
          "yourname@gmail.com",
        );
        const nextFullName = asString(
          me.full_name || me.fullName || nextName,
          nextName,
        );
        const nextPhone = asString(me.phone_e164 || me.phoneE164, "");

        setProfileDraft({
          fullName: nextFullName,
          name: nextName,
          email: nextEmail,
          phoneE164: nextPhone,
        });

        if (me.id || me.email) {
          writeStoredUser({
            id: asString(me.id || user.id),
            role: asString(me.role || user.role, "customer"),
            name: nextName,
            email: nextEmail,
            avatar: asString(me.avatar || user.avatar),
          });
        }
      } catch {
        // keep local defaults
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [user.avatar, user.email, user.id, user.name, user.role]);

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

  const schemaLevelTypes = useMemo(
    () => new Set(schema?.levels.map((l) => l.type) ?? []),
    [schema],
  );
  const showRegion = schemaLevelTypes.has("region") || regions.length > 0;
  const showProvince = schemaLevelTypes.has("province") || provinces.length > 0;
  const showCity = schemaLevelTypes.has("city") || cities.length > 0;
  const showDistrict = schemaLevelTypes.has("district") || districts.length > 0;

  // Load countries once
  useEffect(() => {
    setCountriesLoading(true);
    fetchCountries()
      .then(setCountries)
      .finally(() => setCountriesLoading(false));
  }, []);


  // Country → schema + regions
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

  // Region → provinces
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

  // Province → cities
  useEffect(() => {
    if (!shipping.province_id) return;
    let cancelled = false;
    setCitiesLoading(true);
    setDistricts([]);
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

  // City → districts
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


  const section =
    (searchParams.get("section") as AccountSection | null) ?? "profile";
  const cartCount = useMemo(() => getCartCount(cart), [cart]);
  const activeOrderStatus =
    (searchParams.get("orderStatus") as AccountOrderStatus | null) ?? "active";
  const [orders, setOrders] = useState(
    () => [] as Awaited<ReturnType<typeof fetchOrders>>,
  );
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(
    null,
  );
  const [orderMessage, setOrderMessage] = useState<string>("");
  const filteredOrders = useMemo(
    () => orders.filter((order) => order.status === activeOrderStatus),
    [activeOrderStatus, orders],
  );

  useEffect(() => {
    void fetchOrders()
      .then(setOrders)
      .catch(() => setOrders([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadAddresses = async () => {
      setAddressesLoading(true);
      setAddressesError("");
      try {
        const result = await fetchMyAddresses();
        if (cancelled) return;
        setAddresses(result);
      } catch (error) {
        if (cancelled) return;
        setAddresses([]);
        setAddressesError(
          error instanceof Error ? error.message : "Unable to load addresses.",
        );
      } finally {
        if (!cancelled) setAddressesLoading(false);
      }
    };
    loadAddresses();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshOrders = async () => {
    try {
      const next = await fetchOrders();
      setOrders(next);
    } catch {
      setOrders([]);
    }
  };

  const describeCancelError = (error: unknown) => {
    const msg = error instanceof Error ? error.message : "";
    const n = msg.trim().toLowerCase();
    if (msg === "HTTP_401" || n.includes("unauthorized"))
      return "Please sign in again and retry.";
    if (msg === "HTTP_403" || n.includes("forbidden"))
      return "You can only cancel your own orders.";
    if (msg === "HTTP_404") return "Order not found.";
    if (msg === "HTTP_409") return "This order can't be cancelled anymore.";
    return "Unable to cancel order. Please try again.";
  };

  const getOrderProduct = (title: string) => {
    const normalized = title.toLowerCase();
    return (
      products.find((p) => normalized.includes(p.name.toLowerCase())) ??
      products.find((p) => p.name.toLowerCase().includes(normalized)) ??
      products[0]
    );
  };

  const profileDetails = [
    { label: t("fullName"), value: profileDraft.fullName || profileDraft.name },
    { label: t("nationality"), value: "Philippines" },
    {
      label: t("address"),
      value: (addresses.find((a) => a.is_default) ?? addresses[0])
        ? [
            (addresses.find((a) => a.is_default) ?? addresses[0])!.street,
            (addresses.find((a) => a.is_default) ?? addresses[0])!.barangay,
            (addresses.find((a) => a.is_default) ?? addresses[0])!.city,
            (addresses.find((a) => a.is_default) ?? addresses[0])!.province,
            (addresses.find((a) => a.is_default) ?? addresses[0])!.region,
            (addresses.find((a) => a.is_default) ?? addresses[0])!.country,
            (addresses.find((a) => a.is_default) ?? addresses[0])!.zip_code,
          ]
            .filter(Boolean)
            .join(", ")
        : "No saved address yet",
    },
    { label: t("phoneNumber"), value: profileDraft.phoneE164 },
    { label: t("email"), value: profileDraft.email },
  ];

  const menuSections: {
    id: AccountSection;
    title: string;
    children?: { id: AccountSection; label: string }[];
  }[] = [
    {
      id: "profile",
      title: t("myProfile"),
      children: [
        { id: "profile", label: "Account" },
        { id: "password", label: t("resetPassword") },
        { id: "addresses", label: t("address") },
      ],
    },
    { id: "orders", title: t("myOrders") },
    { id: "notifications", title: t("notifications") },
  ];

  const setSection = (
    next: AccountSection,
    extras?: Record<string, string>,
  ) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("section", next);
    if (next !== "orders") params.delete("orderStatus");
    Object.entries(extras ?? {}).forEach(([key, value]) =>
      params.set(key, value),
    );
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleReset = () => {
    setMessage("");
    if (newPassword.length < 6) {
      setMessage("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }
    setMessage("Password reset request saved.");
    setNewPassword("");
    setConfirmPassword("");
  };

  const saveProfile = async () => {
    setProfileMessage("");
    setProfileSaving(true);
    try {
      const payload = {
        full_name: profileDraft.fullName.trim(),
        email: profileDraft.email.trim(),
        phone_e164: profileDraft.phoneE164.trim(),
        name: profileDraft.name.trim(),
      };

      const response = (await api("/api/users/me", {
        method: "PUT",
        body: JSON.stringify(payload),
      })) as unknown;

      const record = unwrapObject(response) ?? {};
      const me = (unwrapObject(record.user) ?? record) as MeProfile;

      const nextName = asString(me.name || payload.name || user.name, "Your name");
      const nextEmail = asString(
        me.email || payload.email || user.email,
        "yourname@gmail.com",
      );
      const nextFullName = asString(
        me.full_name || me.fullName || payload.full_name || nextName,
        nextName,
      );
      const nextPhone = asString(
        me.phone_e164 || me.phoneE164 || payload.phone_e164,
        "",
      );

      setProfileDraft({
        fullName: nextFullName,
        name: nextName,
        email: nextEmail,
        phoneE164: nextPhone,
      });

      writeStoredUser({
        id: asString(me.id || user.id),
        role: asString(me.role || user.role, "customer"),
        name: nextName,
        email: nextEmail,
        avatar: asString(me.avatar || user.avatar),
      });

      setProfileMessage("Profile updated.");
    } catch (error) {
      setProfileMessage(
        error instanceof Error ? error.message : "Unable to update profile.",
      );
    } finally {
      setProfileSaving(false);
    }
  };

  const addAddress = () => {
    setEditingAddressId("new");
    setAddressDefaultDraft(false);
    setShipping({
      ...initialShipping,
      fullName: user.name ?? "",
      email: user.email ?? "",
    });
    // Reset location state
    setRegions([]);
    setProvinces([]);
    setCities([]);
    setDistricts([]);
  };

  const editAddress = (address: Address) => {
    setEditingAddressId(address.id);
    setAddressDefaultDraft(Boolean(address.is_default));
    setRegions([]);
    setProvinces([]);
    setCities([]);
    setDistricts([]);
    setShipping({
      ...initialShipping,
      fullName: address.full_name ?? "",
      email: address.email ?? "",
      phoneNumber: address.phone ?? "",
      address: address.street ?? "",
      postalCode: address.zip_code ?? "",
      country_id: address.country_code ?? "PH",
      country: address.country ?? "",
      region_id: address.region_id ?? "",
      region: address.region ?? "",
      province_id: address.province_id ?? "",
      province: address.province ?? "",
      city_id: address.city_id ?? "",
      city: address.city ?? "",
      district_id: address.district_id ?? "",
      barangay: address.barangay ?? "",
    });
  };

  const saveAddress = async () => {
    setAddressesError("");
    try {
      const payload: CreateAddressInput = {
        full_name: shipping.fullName.trim(),
        email: shipping.email.trim(),
        phone: shipping.phoneNumber.trim(),
        zip_code: shipping.postalCode.trim(),
        street: shipping.address.trim(),
        country_code: shipping.country_id,
        region_id: shipping.region_id || undefined,
        province_id: shipping.province_id || undefined,
        city_id: shipping.city_id || undefined,
        district_id: shipping.district_id || undefined,
        is_default: addressDefaultDraft || undefined,
      };
      if (editingAddressId && editingAddressId !== "new") {
        await updateAddress(editingAddressId, payload);
      } else {
        await createAddress(payload);
      }

      const refreshed = await fetchMyAddresses();
      setAddresses(refreshed);
      setEditingAddressId(null);
    } catch (error) {
      setAddressesError(
        error instanceof Error ? error.message : "Unable to save address.",
      );
    }
  };

  const handleDeleteAddress = async (addressId: number) => {
    setAddressesError("");
    try {
      await deleteAddress(addressId);
      const refreshed = await fetchMyAddresses();
      setAddresses(refreshed);
      if (editingAddressId === addressId) setEditingAddressId(null);
    } catch (error) {
      setAddressesError(
        error instanceof Error ? error.message : "Unable to delete address.",
      );
    }
  };

  const handleSetDefault = async (addressId: number) => {
    setAddressesError("");
    try {
      await setDefaultAddress(addressId);
      const refreshed = await fetchMyAddresses();
      setAddresses(refreshed);
    } catch (error) {
      setAddressesError(
        error instanceof Error ? error.message : "Unable to set default address.",
      );
    }
  };

  const selectClassName =
    "h-12 rounded-2xl border border-neutral-300 px-4 dark:border-[#d6b736] dark:bg-[#050505] dark:text-[#f0d34f]";
  const placeholderSelectClassName = `${selectClassName} text-neutral-500 dark:text-[#8e7727]`;

  // ─── renderContent ───────────────────────────────────────────────────────────

  const renderContent = () => {
    if (section === "password") {
      return (
        <div className="rounded-[24px] border border-neutral-200 bg-white p-6 dark:border-[#2f2a16] dark:bg-[#0a0a09]">
          <h2 className="text-2xl font-semibold text-[#111] dark:text-[#f1d04b]">
            {t("resetPassword")}
          </h2>
          <div className="mt-4 space-y-3">
            <input
              type="password"
              placeholder={t("newPassword")}
              className="h-11 w-full rounded-xl border border-neutral-300 px-4 dark:border-[#d9b92f] dark:bg-[#080808] dark:text-[#f1d04b]"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <input
              type="password"
              placeholder={t("confirmPassword")}
              className="h-11 w-full rounded-xl border border-neutral-300 px-4 dark:border-[#d9b92f] dark:bg-[#080808] dark:text-[#f1d04b]"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <button
              type="button"
              className="rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white dark:bg-[#f1d04b] dark:text-[#090909]"
              onClick={handleReset}
            >
              {t("savePassword")}
            </button>
            {message ? (
              <p className="text-sm text-neutral-700 dark:text-[#d6c67f]">
                {message}
              </p>
            ) : null}
          </div>
        </div>
      );
    }

    if (section === "addresses") {
      const defaultAddressId =
        addresses.find((a) => a.is_default)?.id ?? null;

      return (
        <div className="rounded-[24px] border border-neutral-200 bg-white p-6 dark:border-[#2f2a16] dark:bg-[#0a0a09]">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-2xl font-semibold text-[#111] dark:text-[#f1d04b]">
              {t("address")}
            </h2>
            <button
              type="button"
              className="rounded-xl bg-[#f15a2b] px-5 py-3 text-sm font-semibold text-white"
              onClick={addAddress}
            >
              + Add New Address
            </button>
          </div>

          <div className="mt-6 space-y-4">
            {addressesError ? (
              <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-900 dark:border-rose-500/30 dark:bg-rose-950/20 dark:text-rose-100">
                {addressesError}
              </div>
            ) : null}

            {editingAddressId !== null ? (
              <div className="rounded-[20px] border border-neutral-200 p-5 dark:border-[#2c2817]">
                {typeof editingAddressId === "number" ? (
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <p className="text-sm font-semibold text-neutral-700 dark:text-[#c7ba81]">
                      Editing saved address
                    </p>
                    <button
                      type="button"
                      className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 dark:border-rose-500/40 dark:text-rose-200"
                      onClick={() => void handleDeleteAddress(editingAddressId)}
                    >
                      Delete
                    </button>
                  </div>
                ) : null}
                <div className="grid gap-4 md:grid-cols-2">
                  <input
                    type="text"
                    placeholder={t("fullName")}
                    value={shipping.fullName}
                    onChange={(e) =>
                      updateShippingField("fullName", e.target.value)
                    }
                    className="h-12 rounded-2xl border border-neutral-300 px-4 dark:border-[#d6b736] dark:bg-[#050505] dark:text-[#f0d34f] dark:placeholder:text-[#8e7727]"
                  />
                  <input
                    type="email"
                    placeholder={t("email")}
                    value={shipping.email}
                    onChange={(e) =>
                      updateShippingField("email", e.target.value)
                    }
                    className="h-12 rounded-2xl border border-neutral-300 px-4 dark:border-[#d6b736] dark:bg-[#050505] dark:text-[#f0d34f] dark:placeholder:text-[#8e7727]"
                  />

                  <PhoneNumberPicker
                    placeholder={t("phoneNumber")}
                    value={shipping.phoneNumber}
                    selectedCountryCode={shipping.country_id}
                    onChange={(next) =>
                      updateShippingField("phoneNumber", next)
                    }
                    className="h-12 w-full bg-white px-4 text-neutral-900 outline-none dark:bg-[#050505] dark:text-[#f0d34f] dark:placeholder:text-[#8e7727]"
                  />

                  {/* Country */}
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

                  {/* Region */}
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

                  {/* Province */}
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

                  {/* City */}
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
                        schema?.levels.find((l) => l.type === "city")?.label ??
                        t("city")
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

                  {/* District / Barangay */}
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
                      updateShippingField("postalCode", e.target.value)
                    }
                    className="h-12 rounded-2xl border border-neutral-300 px-4 dark:border-[#d6b736] dark:bg-[#050505] dark:text-[#f0d34f] dark:placeholder:text-[#8e7727]"
                  />
                  <textarea
                    placeholder={t("streetAddress")}
                    value={shipping.address}
                    onChange={(e) =>
                      updateShippingField("address", e.target.value)
                    }
                    className="min-h-[120px] rounded-2xl border border-neutral-300 px-4 py-3 md:col-span-2 dark:border-[#d6b736] dark:bg-[#050505] dark:text-[#f0d34f] dark:placeholder:text-[#8e7727]"
                  />
                </div>
                <label className="mt-4 flex items-center gap-3 text-sm text-neutral-700 dark:text-[#c7ba81]">
                  <input
                    type="checkbox"
                    checked={addressDefaultDraft}
                    onChange={(e) => setAddressDefaultDraft(e.target.checked)}
                    className="h-4 w-4 rounded border-neutral-300 text-[#f15a2b] accent-[#f15a2b]"
                  />
                  Set as default
                </label>
                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white dark:bg-[#f1d04b] dark:text-[#090909]"
                    onClick={saveAddress}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-neutral-300 px-4 py-2 text-sm dark:border-[#d9b92f]"
                    onClick={() => setEditingAddressId(null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}

            {!addressesLoading &&
            addresses.length === 0 &&
            editingAddressId === null ? (
              <div className="rounded-[20px] border border-dashed border-neutral-300 px-5 py-10 text-center text-sm text-neutral-500 dark:border-[#2c2817] dark:text-[#c7ba81]">
                No saved address yet. Add your first address before using saved
                checkout details.
              </div>
            ) : null}

            {addresses.map((address) => (
              <div
                key={address.id}
                className="rounded-[20px] border border-neutral-200 p-5 dark:border-[#2c2817]"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-lg font-semibold text-[#111] dark:text-[#f1d04b]">
                      {address.full_name}{" "}
                      <span className="ml-3 text-sm font-normal text-neutral-500 dark:text-[#c7ba81]">
                        {address.email}
                      </span>
                    </p>
                    <p className="mt-2 text-neutral-600 dark:text-[#c7ba81]">
                      {[address.city, address.province, address.region]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                    <p className="text-neutral-600 dark:text-[#c7ba81]">
                      {[
                        address.street,
                        address.barangay,
                        address.country,
                        address.zip_code,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                    {defaultAddressId === address.id ? (
                      <span className="mt-3 inline-flex rounded-md border border-[#f15a2b] px-2 py-1 text-xs font-medium text-[#f15a2b]">
                        Default
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2 md:justify-end">
                    {defaultAddressId !== address.id ? (
                      <button
                        type="button"
                        className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 dark:border-[#2c2817] dark:text-[#cfbd78]"
                        onClick={() => void handleSetDefault(address.id)}
                      >
                        Set Default
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 dark:border-[#2c2817] dark:text-[#cfbd78]"
                      onClick={() => editAddress(address)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 dark:border-rose-500/40 dark:text-rose-200"
                      onClick={() => void handleDeleteAddress(address.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (section === "orders") {
      const orderTabs: { id: AccountOrderStatus; label: string }[] = [
        { id: "active", label: "Active Orders" },
        { id: "upcoming", label: "Upcoming" },
        { id: "cancelled", label: "Cancelled" },
        { id: "received", label: "Received" },
      ];

      return (
        <div className="rounded-[24px] border border-neutral-200 bg-white p-6 dark:border-[#2f2a16] dark:bg-[#0a0a09]">
          <div className="mb-5 flex flex-wrap gap-3">
            {orderTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSection("orders", { orderStatus: tab.id })}
                className={`rounded-2xl px-5 py-3 text-sm font-medium transition ${activeOrderStatus === tab.id ? "bg-[#111827] text-white dark:bg-[#f0d34f] dark:text-[#090909]" : "border border-neutral-300 bg-white text-neutral-700 dark:border-[#2c2817] dark:bg-[#090909] dark:text-[#cfbd78]"}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {orderMessage ? (
            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-[#1a1405] dark:text-amber-200">
              {orderMessage}
            </div>
          ) : null}
          <div className="space-y-4">
            {filteredOrders.map((order) => (
              <div
                key={order.id}
                className="rounded-[20px] border border-neutral-200 p-5 dark:border-[#2c2817]"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-4">
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-neutral-200 dark:border-[#2c2817]">
                      <img
                        src={order.image || getOrderProduct(order.title).image}
                        alt={order.title}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500 dark:text-[#cfbd78]">
                        {order.courier}
                      </p>
                      <h3 className="mt-2 text-xl font-semibold text-[#111] dark:text-[#f1d04b]">
                        {order.title}
                      </h3>
                      <p className="mt-1 text-neutral-600 dark:text-[#c7ba81]">
                        {order.summary}
                      </p>
                      <p className="mt-1 text-sm text-neutral-400 dark:text-[#8e7727]">
                        {order.trackingNo}
                      </p>
                      <p className="mt-1 text-sm text-neutral-500 dark:text-[#cfbd78]">
                        Payment: {order.paymentMethod}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-[#111] dark:text-[#f1d04b]">
                      {order.deliveryDate}
                    </p>
                    <p className="mt-2 text-sm text-neutral-500 dark:text-[#cfbd78]">
                      Total: {formatCurrency(order.total)}
                    </p>
                    <button
                      type="button"
                      className="mt-3 rounded-xl border border-neutral-300 px-4 py-2 text-sm dark:border-[#d9b92f]"
                      onClick={() => router.push("/user/history")}
                    >
                      View Full Tracking
                    </button>
                    <button
                      type="button"
                      disabled={
                        cancellingOrderId === order.id ||
                        (order.rawStatus ?? "").toLowerCase() !== "pending" ||
                        (order.shipmentStatus ?? "")
                          .toLowerCase()
                          .includes("ship")
                      }
                      onClick={async () => {
                        setCancellingOrderId(order.id);
                        setOrderMessage("");
                        try {
                          await cancelOrder(order.id);
                          await refreshOrders();
                        } catch (error) {
                          setOrderMessage(describeCancelError(error));
                        } finally {
                          setCancellingOrderId(null);
                        }
                      }}
                      className="mt-3 w-full rounded-xl border border-rose-200 px-4 py-2 text-sm font-medium text-rose-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-500/30 dark:text-rose-300"
                    >
                      Cancel Order
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {filteredOrders.length === 0 ? (
              <p className="text-neutral-500 dark:text-[#c7ba81]">
                No orders here yet.
              </p>
            ) : null}
          </div>
        </div>
      );
    }

    if (section === "notifications") {
      return (
        <div className="rounded-[24px] border border-neutral-200 bg-white p-0 dark:border-[#2f2a16] dark:bg-[#0a0a09]">
          <div className="border-b border-neutral-200 px-6 py-5 dark:border-[#2c2817]">
            <h2 className="text-2xl font-semibold text-[#111] dark:text-[#f1d04b]">
              {t("notifications")}
            </h2>
          </div>
          <div className="max-h-[620px] overflow-auto">
            {notifications.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className="flex w-full gap-4 border-b border-neutral-200 px-6 py-5 text-left transition last:border-b-0 hover:bg-neutral-50 dark:border-[#2c2817] dark:hover:bg-[#11110f]"
                onClick={() =>
                  router.push("/user/account?section=notifications")
                }
              >
                <div className="h-16 w-16 overflow-hidden rounded-xl border border-neutral-200 dark:border-[#2c2817]">
                  <img
                    src={
                      item.image ??
                      notificationImages[index % notificationImages.length]
                    }
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-base font-semibold text-[#111] dark:text-[#f1d04b]">
                        {getNotificationTitle(item.message)}
                      </p>
                      <span className="shrink-0 text-xs text-neutral-400 dark:text-[#8e7727]">
                        2 min ago
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-neutral-500 dark:text-[#c7ba81]">
                      {item.message}
                    </p>
                  </div>
                </button>
              ))}
            {notifications.length === 0 ? (
              <p className="px-6 py-5 text-neutral-500 dark:text-[#c7ba81]">
                No notifications yet.
              </p>
            ) : null}
          </div>
        </div>
      );
    }

    // Default: profile section
    return (
      <div className="space-y-6">
        <div className="rounded-[24px] border border-neutral-200 bg-[linear-gradient(180deg,#ffffff_0%,#f6f7fb_100%)] p-6 dark:border-[#2c2817] dark:bg-[linear-gradient(180deg,#0d0d0c_0%,#090909_100%)]">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-[#e9eef5] text-[#4b5563] dark:bg-[#171711] dark:text-[#f1d04b]">
              {profileImage ? (
                <img
                  src={profileImage}
                  alt={profileDraft.fullName || profileDraft.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-14 w-14"
                  fill="none"
                >
                  <path
                    d="M17 20C17 17.791 14.761 16 12 16C9.239 16 7 17.791 7 20"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle
                    cx="12"
                    cy="9"
                    r="3.6"
                    stroke="currentColor"
                    strokeWidth="1.7"
                  />
                </svg>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-4xl font-semibold tracking-[-0.03em] text-[#111] dark:text-[#f1d04b]">
                  {profileDraft.fullName || profileDraft.name}
                </h1>
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#2563eb] text-white">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-3.5 w-3.5"
                    fill="none"
                  >
                    <path
                      d="M8.5 12.5L10.8 14.8L15.5 10.1"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </div>
              <p className="mt-2 text-lg text-neutral-600 dark:text-[#c7ba81]">
                {profileDraft.email}
              </p>
              <p className="mt-3 text-sm uppercase tracking-[0.24em] text-neutral-400 dark:text-[#8e7727]">
                {user.role ?? "user"}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[24px] border border-neutral-200 bg-white p-6 dark:border-[#2f2a16] dark:bg-[#0a0a09]">
          <h2 className="text-2xl font-semibold text-[#111] dark:text-[#f1d04b]">
            {t("myProfile")}
          </h2>
          <p className="mt-1 text-sm text-neutral-500 dark:text-[#c7ba81]">
            Manage and protect your account.
          </p>
          <div className="mt-6 grid gap-6 lg:grid-cols-1">
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm text-neutral-500 dark:text-[#c7ba81]">
                    {t("fullName")}
                  </span>
                  <input
                    className="h-12 w-full rounded-xl border border-neutral-300 px-4 dark:border-[#d9b92f] dark:bg-[#080808]"
                    value={profileDraft.fullName}
                    onChange={(e) =>
                      setProfileDraft((c) => ({
                        ...c,
                        fullName: e.target.value,
                        name: e.target.value,
                      }))
                    }
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm text-neutral-500 dark:text-[#c7ba81]">
                    {t("email")}
                  </span>
                  <input
                    className="h-12 w-full rounded-xl border border-neutral-300 px-4 dark:border-[#d9b92f] dark:bg-[#080808]"
                    value={profileDraft.email}
                    onChange={(e) =>
                      setProfileDraft((c) => ({ ...c, email: e.target.value }))
                    }
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm text-neutral-500 dark:text-[#c7ba81]">
                    {t("phoneNumber")}
                  </span>
                  <input
                    className="h-12 w-full rounded-xl border border-neutral-300 px-4 dark:border-[#d9b92f] dark:bg-[#080808]"
                    value={profileDraft.phoneE164}
                    onChange={(e) =>
                      setProfileDraft((c) => ({
                        ...c,
                        phoneE164: e.target.value,
                      }))
                    }
                  />
                </label>
              </div>
              <button
                type="button"
                className="rounded-xl bg-[#f15a2b] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                onClick={saveProfile}
                disabled={profileSaving}
              >
                {profileSaving ? "Saving..." : "Save"}
              </button>
              {profileMessage ? (
                <p className="text-sm text-neutral-600 dark:text-[#c7ba81]">
                  {profileMessage}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="rounded-[24px] border border-neutral-200 bg-white p-5 dark:border-[#2c2817] dark:bg-[#0a0a09]">
          <h2 className="text-xl font-semibold text-[#111] dark:text-[#f1d04b]">
            {t("personalDetails")}
          </h2>
          <div className="mt-5 overflow-hidden rounded-[20px] border border-neutral-200 dark:border-[#2c2817]">
            {profileDetails.map((detail) => (
              <div
                key={detail.label}
                className="grid gap-2 border-b border-neutral-200 px-4 py-4 text-sm last:border-b-0 dark:border-[#2c2817] md:grid-cols-[220px_1fr]"
              >
                <p className="text-neutral-500 dark:text-[#9f9156]">
                  {detail.label}
                </p>
                <p className="font-medium text-[#111] dark:text-[#f1d04b]">
                  {detail.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-[#f7f7f7] text-[#111] transition-colors dark:bg-[#090909] dark:bg-[radial-gradient(circle_at_top,rgba(112,95,25,0.14),transparent_20%),linear-gradient(180deg,#080808_0%,#0c0c0b_100%)] dark:text-[#f1d04b]">
      <StoreHeader cartCount={cartCount} />
      <section className="mx-auto max-w-[1380px] px-4 py-8 sm:px-6">
        <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="rounded-[24px] border border-neutral-200 bg-white p-5 shadow-sm dark:border-[#2f2a16] dark:bg-[#090909]">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-[#f1f1f1] text-neutral-400 dark:bg-[#171711] dark:text-[#8e7727]">
                {profileImage ? (
                  <img
                    src={profileImage}
                    alt={profileDraft.fullName || profileDraft.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-9 w-9"
                    fill="none"
                  >
                    <path
                      d="M17 20C17 17.791 14.761 16 12 16C9.239 16 7 17.791 7 20"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle
                      cx="12"
                      cy="9"
                      r="3.4"
                      stroke="currentColor"
                      strokeWidth="1.7"
                    />
                  </svg>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate font-semibold text-[#111] dark:text-[#f1d04b]">
                  {user.name ?? "twis3"}
                </p>
                <p className="truncate text-sm text-neutral-500 dark:text-[#c7ba81]">
                  Edit Profile
                </p>
              </div>
            </div>

            <div className="mt-8 space-y-4">
              {menuSections.map((menu) => (
                <div key={menu.id}>
                  <button
                    type="button"
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left font-semibold transition ${section === menu.id || menu.children?.some((child) => child.id === section) ? "bg-neutral-100 text-[#111] dark:bg-[#141412] dark:text-[#f1d04b]" : "text-[#111] dark:text-[#f1d04b]"}`}
                    onClick={() => setSection(menu.id)}
                  >
                    {menu.id === "profile" ? (
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        className="h-5 w-5 shrink-0"
                        fill="none"
                      >
                        <path
                          d="M17 20C17 17.791 14.761 16 12 16C9.239 16 7 17.791 7 20"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <circle
                          cx="12"
                          cy="9"
                          r="3"
                          stroke="currentColor"
                          strokeWidth="1.7"
                        />
                      </svg>
                    ) : null}
                    {menu.id === "orders" ? (
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        className="h-5 w-5 shrink-0"
                        fill="none"
                      >
                        <path
                          d="M4 7.5H20"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                        />
                        <path
                          d="M6.5 4.5H17.5V19.5H6.5V4.5Z"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M9 10.5H15"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                        />
                        <path
                          d="M9 14.5H13"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                        />
                      </svg>
                    ) : null}
                    {menu.id === "notifications" ? (
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        className="h-5 w-5 shrink-0"
                        fill="none"
                      >
                        <path
                          d="M14.857 17H9.143M18 17V11C18 8.239 15.761 6 13 6H11C8.239 6 6 8.239 6 11V17L4 19H20L18 17Z"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M10.5 19C10.764 19.622 11.332 20 12 20C12.668 20 13.236 19.622 13.5 19"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : null}
                    <span>{menu.title}</span>
                  </button>
                  {menu.children &&
                  (section === menu.id ||
                    menu.children.some((child) => child.id === section)) ? (
                    <div className="mt-2 space-y-1 pl-4">
                      {menu.children.map((child) => (
                        <button
                          key={child.id}
                          type="button"
                          className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition ${section === child.id ? "text-[#f15a2b] dark:text-[#f0d34f]" : "text-neutral-600 dark:text-[#c7ba81]"}`}
                          onClick={() => setSection(child.id)}
                        >
                          {child.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </aside>

          <div className="rounded-[28px] border border-neutral-200 bg-white/90 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] dark:border-[#2f2a16] dark:bg-[#090909] dark:shadow-[0_0_0_1px_rgba(217,185,47,0.08)]">
            <p className="text-sm text-neutral-500 dark:text-[#9f9156]">
              {t("accountProfile")}
            </p>
            <div className="mt-6">{renderContent()}</div>
          </div>
        </div>
      </section>
    </main>
  );
}
