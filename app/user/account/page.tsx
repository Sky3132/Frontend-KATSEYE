"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type ChangeEvent, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { USER_STORAGE_KEY } from "../../lib/auth";
import StoreHeader from "../components/store-header";
import {
  getCartCount,
  getCartServerSnapshot,
  readCart,
  subscribeCart,
} from "../lib/cart";
import {
  notificationImages,
  readStoredAddresses,
  type AccountAddress,
  type AccountOrderStatus,
  type AccountSection,
  writeStoredAddresses,
} from "../lib/account-content";
import { cancelOrder, fetchOrders } from "../lib/orders-api";
import { products } from "../lib/products";
import { useStoreSettings } from "../lib/store-settings";

type StoredUser = {
  id?: string;
  name?: string;
  email?: string;
  role?: string;
  avatar?: string;
};

  type NotificationItem = {
  id: string;
  message: string;
  createdAt: string;
  read: boolean;
  image?: string;
  productId?: string;
};

const createEmptyAddress = (): AccountAddress => ({
  id: `addr-${Date.now()}`,
  name: "",
  phone: "",
  line1: "",
  line2: "",
  isDefault: false,
});

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

export default function AccountPage() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { formatCurrency, t } = useStoreSettings();
  const cart = useSyncExternalStore(subscribeCart, readCart, getCartServerSnapshot);
  const user = useSyncExternalStore(subscribeUser, readStoredUser, () => EMPTY_USER);
  const notifications = useSyncExternalStore(subscribeUser, readStoredNotifications, () => []);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [addresses, setAddresses] = useState<AccountAddress[]>(() => readStoredAddresses());
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addressDraft, setAddressDraft] = useState<AccountAddress>(() => readStoredAddresses()[0] ?? createEmptyAddress());
  const [profileDraft, setProfileDraft] = useState({
    name: user.name ?? "Your name",
    email: user.email ?? "yourname@gmail.com",
    phone: "+63 912 345 6789",
  });
  const [profileMessage, setProfileMessage] = useState("");
  const [profileImage, setProfileImage] = useState(user.avatar ?? "");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const section = (searchParams.get("section") as AccountSection | null) ?? "profile";
  const cartCount = useMemo(() => getCartCount(cart), [cart]);
  const activeOrderStatus = ((searchParams.get("orderStatus") as AccountOrderStatus | null) ?? "active");
  const [orders, setOrders] = useState(() => [] as Awaited<ReturnType<typeof fetchOrders>>);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [orderMessage, setOrderMessage] = useState<string>("");
  const filteredOrders = useMemo(
    () => orders.filter((order) => order.status === activeOrderStatus),
    [activeOrderStatus, orders],
  );

  useEffect(() => {
    void fetchOrders().then(setOrders).catch(() => setOrders([]));
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
    const message = error instanceof Error ? error.message : "";
    const normalized = message.trim().toLowerCase();
    if (message === "HTTP_401" || normalized.includes("unauthorized"))
      return "Please sign in again and retry.";
    if (message === "HTTP_403" || normalized.includes("forbidden"))
      return "You can only cancel your own orders.";
    if (message === "HTTP_404") return "Order not found.";
    if (message === "HTTP_409") return "This order can’t be cancelled anymore.";
    return "Unable to cancel order. Please try again.";
  };

  useEffect(() => {
    writeStoredAddresses(addresses);
  }, [addresses]);

  const getOrderProduct = (title: string) => {
    const normalized = title.toLowerCase();
    return (
      products.find((product) => normalized.includes(product.name.toLowerCase())) ??
      products.find((product) => product.name.toLowerCase().includes(normalized)) ??
      products[0]
    );
  };

  const profileDetails = [
    { label: t("fullName"), value: profileDraft.name },
    { label: t("nationality"), value: "Philippines" },
    { label: t("address"), value: addresses.find((address) => address.isDefault)?.line2 ?? "No saved address yet" },
    { label: t("phoneNumber"), value: profileDraft.phone },
    { label: t("email"), value: profileDraft.email },
  ];

  const menuSections: { id: AccountSection; title: string; children?: { id: AccountSection; label: string }[] }[] = [
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

  const setSection = (next: AccountSection, extras?: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("section", next);
    if (next !== "orders") {
      params.delete("orderStatus");
    }
    Object.entries(extras ?? {}).forEach(([key, value]) => params.set(key, value));
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

  const saveProfile = () => {
    const nextUser = {
      ...user,
      name: profileDraft.name,
      email: profileDraft.email,
      avatar: profileImage,
    };
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(nextUser));
    window.dispatchEvent(new Event("storage"));
    setProfileMessage("Profile updated.");
  };

  const handleImageSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setProfileMessage("Please choose a JPEG or PNG image.");
      return;
    }

    if (file.size > 1024 * 1024) {
      setProfileMessage("Image must be 1 MB or smaller.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setProfileImage(reader.result);
        setProfileMessage("Profile image selected. Click Save to apply it.");
      }
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const removeProfileImage = () => {
    setProfileImage("");
    setProfileMessage("Profile image removed. Click Save to apply it.");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const startEditingAddress = (address: AccountAddress) => {
    setEditingAddressId(address.id);
    setAddressDraft(address);
  };

  const saveAddress = () => {
    setAddresses((current) => current.map((address) => (address.id === addressDraft.id ? addressDraft : address)));
    setEditingAddressId(null);
  };

  const addAddress = () => {
    const next: AccountAddress = {
      id: `addr-${Date.now()}`,
      name: "",
      phone: "",
      line1: "",
      line2: "",
      isDefault: addresses.length === 0,
    };
    setAddresses((current) => [...current, next]);
    setEditingAddressId(next.id);
    setAddressDraft(next);
  };

  const setDefaultAddress = (id: string) => {
    setAddresses((current) => current.map((address) => ({ ...address, isDefault: address.id === id })));
  };

  const removeAddress = (id: string) => {
    setAddresses((current) => {
      const next = current.filter((address) => address.id !== id);
      if (next.length === 0) return [];
      if (next.some((address) => address.isDefault)) return next;
      return next.map((address, index) => ({ ...address, isDefault: index === 0 }));
    });

    if (editingAddressId === id) {
      setEditingAddressId(null);
    }
  };

  const renderContent = () => {
    if (section === "password") {
      return (
        <div className="rounded-[24px] border border-neutral-200 bg-white p-6 dark:border-[#2f2a16] dark:bg-[#0a0a09]">
          <h2 className="text-2xl font-semibold text-[#111] dark:text-[#f1d04b]">{t("resetPassword")}</h2>
          <div className="mt-4 space-y-3">
            <input
              type="password"
              placeholder={t("newPassword")}
              className="h-11 w-full rounded-xl border border-neutral-300 px-4 dark:border-[#d9b92f] dark:bg-[#080808] dark:text-[#f1d04b]"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
            <input
              type="password"
              placeholder={t("confirmPassword")}
              className="h-11 w-full rounded-xl border border-neutral-300 px-4 dark:border-[#d9b92f] dark:bg-[#080808] dark:text-[#f1d04b]"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
            <button type="button" className="rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white dark:bg-[#f1d04b] dark:text-[#090909]" onClick={handleReset}>
              {t("savePassword")}
            </button>
            {message ? <p className="text-sm text-neutral-700 dark:text-[#d6c67f]">{message}</p> : null}
          </div>
        </div>
      );
    }

    if (section === "addresses") {
      return (
        <div className="rounded-[24px] border border-neutral-200 bg-white p-6 dark:border-[#2f2a16] dark:bg-[#0a0a09]">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-2xl font-semibold text-[#111] dark:text-[#f1d04b]">{t("address")}</h2>
            <button
              type="button"
              className="rounded-xl bg-[#f15a2b] px-5 py-3 text-sm font-semibold text-white"
              onClick={addAddress}
            >
              + Add New Address
            </button>
          </div>
          <div className="mt-6 space-y-4">
            {addresses.length === 0 ? (
              <div className="rounded-[20px] border border-dashed border-neutral-300 px-5 py-10 text-center text-sm text-neutral-500 dark:border-[#2c2817] dark:text-[#c7ba81]">
                No saved address yet. Add your first address before using saved checkout details.
              </div>
            ) : null}
            {addresses.map((address) => (
              <div key={address.id} className="rounded-[20px] border border-neutral-200 p-5 dark:border-[#2c2817]">
                {editingAddressId === address.id ? (
                  <div className="space-y-3">
                    <input className="h-11 w-full rounded-xl border border-neutral-300 px-4 dark:border-[#d9b92f] dark:bg-[#080808]" value={addressDraft.name} onChange={(event) => setAddressDraft((current) => ({ ...current, name: event.target.value }))} />
                    <input className="h-11 w-full rounded-xl border border-neutral-300 px-4 dark:border-[#d9b92f] dark:bg-[#080808]" value={addressDraft.phone} onChange={(event) => setAddressDraft((current) => ({ ...current, phone: event.target.value }))} />
                    <input className="h-11 w-full rounded-xl border border-neutral-300 px-4 dark:border-[#d9b92f] dark:bg-[#080808]" value={addressDraft.line1} onChange={(event) => setAddressDraft((current) => ({ ...current, line1: event.target.value }))} />
                    <textarea className="min-h-[96px] w-full rounded-xl border border-neutral-300 px-4 py-3 dark:border-[#d9b92f] dark:bg-[#080808]" value={addressDraft.line2} onChange={(event) => setAddressDraft((current) => ({ ...current, line2: event.target.value }))} />
                    <div className="flex gap-3">
                      <button type="button" className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white dark:bg-[#f1d04b] dark:text-[#090909]" onClick={saveAddress}>Save</button>
                      <button type="button" className="rounded-xl border border-neutral-300 px-4 py-2 text-sm dark:border-[#d9b92f]" onClick={() => setEditingAddressId(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-lg font-semibold text-[#111] dark:text-[#f1d04b]">{address.name} <span className="ml-3 text-sm font-normal text-neutral-500 dark:text-[#c7ba81]">{address.phone}</span></p>
                      <p className="mt-2 text-neutral-600 dark:text-[#c7ba81]">{address.line1}</p>
                      <p className="text-neutral-600 dark:text-[#c7ba81]">{address.line2}</p>
                      {address.isDefault ? (
                        <span className="mt-3 inline-flex rounded-md border border-[#f15a2b] px-2 py-1 text-xs font-medium text-[#f15a2b]">Default</span>
                      ) : null}
                    </div>
                    <div className="flex gap-3">
                      <button type="button" className="text-sm font-medium text-[#2563eb] dark:text-[#f0d34f]" onClick={() => startEditingAddress(address)}>Edit</button>
                      <button type="button" className="text-sm font-medium text-[#f15a2b] dark:text-[#f0d34f]" onClick={() => removeAddress(address.id)}>Remove</button>
                      {!address.isDefault ? (
                        <button type="button" className="rounded-lg border border-neutral-300 px-4 py-2 text-sm dark:border-[#d9b92f]" onClick={() => setDefaultAddress(address.id)}>
                          Set as default
                        </button>
                      ) : null}
                    </div>
                  </div>
                )}
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
                className={`rounded-2xl px-5 py-3 text-sm font-medium transition ${
                  activeOrderStatus === tab.id
                    ? "bg-[#111827] text-white dark:bg-[#f0d34f] dark:text-[#090909]"
                    : "border border-neutral-300 bg-white text-neutral-700 dark:border-[#2c2817] dark:bg-[#090909] dark:text-[#cfbd78]"
                }`}
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
              <div key={order.id} className="rounded-[20px] border border-neutral-200 p-5 dark:border-[#2c2817]">
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
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500 dark:text-[#cfbd78]">{order.courier}</p>
                      <h3 className="mt-2 text-xl font-semibold text-[#111] dark:text-[#f1d04b]">{order.title}</h3>
                      <p className="mt-1 text-neutral-600 dark:text-[#c7ba81]">{order.summary}</p>
                      <p className="mt-1 text-sm text-neutral-400 dark:text-[#8e7727]">{order.trackingNo}</p>
                      <p className="mt-1 text-sm text-neutral-500 dark:text-[#cfbd78]">Payment: {order.paymentMethod}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-[#111] dark:text-[#f1d04b]">{order.deliveryDate}</p>
                    <p className="mt-2 text-sm text-neutral-500 dark:text-[#cfbd78]">Total: {formatCurrency(order.total)}</p>
                    <button type="button" className="mt-3 rounded-xl border border-neutral-300 px-4 py-2 text-sm dark:border-[#d9b92f]" onClick={() => router.push("/user/history")}>
                      View Full Tracking
                    </button>
                    <button
                      type="button"
                      disabled={
                        cancellingOrderId === order.id ||
                        (order.rawStatus ?? "").toLowerCase() !== "pending" ||
                        (order.shipmentStatus ?? "").toLowerCase().includes("ship")
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
            {filteredOrders.length === 0 ? <p className="text-neutral-500 dark:text-[#c7ba81]">No orders here yet.</p> : null}
          </div>
        </div>
      );
    }

    if (section === "notifications") {
      return (
        <div className="rounded-[24px] border border-neutral-200 bg-white p-0 dark:border-[#2f2a16] dark:bg-[#0a0a09]">
          <div className="border-b border-neutral-200 px-6 py-5 dark:border-[#2c2817]">
            <h2 className="text-2xl font-semibold text-[#111] dark:text-[#f1d04b]">{t("notifications")}</h2>
          </div>
          <div className="max-h-[620px] overflow-auto">
            {notifications.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className="flex w-full gap-4 border-b border-neutral-200 px-6 py-5 text-left transition last:border-b-0 hover:bg-neutral-50 dark:border-[#2c2817] dark:hover:bg-[#11110f]"
                onClick={() => router.push("/user/account?section=notifications")}
              >
                <div className="h-16 w-16 overflow-hidden rounded-xl border border-neutral-200 dark:border-[#2c2817]">
                  <img
                    src={item.image ?? notificationImages[index % notificationImages.length]}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-base font-semibold text-[#111] dark:text-[#f1d04b]">{item.message}</p>
                    <span className="shrink-0 text-xs text-neutral-400 dark:text-[#8e7727]">2 min ago</span>
                  </div>
                  <p className="mt-2 text-sm text-neutral-500 dark:text-[#c7ba81]">Your latest store update is saved here so you can review it anytime.</p>
                </div>
              </button>
            ))}
            {notifications.length === 0 ? <p className="px-6 py-5 text-neutral-500 dark:text-[#c7ba81]">No notifications yet.</p> : null}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="rounded-[24px] border border-neutral-200 bg-[linear-gradient(180deg,#ffffff_0%,#f6f7fb_100%)] p-6 dark:border-[#2c2817] dark:bg-[linear-gradient(180deg,#0d0d0c_0%,#090909_100%)]">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-[#e9eef5] text-[#4b5563] dark:bg-[#171711] dark:text-[#f1d04b]">
              {profileImage ? (
                <img src={profileImage} alt={profileDraft.name} className="h-full w-full object-cover" />
              ) : (
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-14 w-14" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17 20C17 17.791 14.761 16 12 16C9.239 16 7 17.791 7 20" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="9" r="3.6" stroke="currentColor" strokeWidth="1.7" />
                </svg>
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-4xl font-semibold tracking-[-0.03em] text-[#111] dark:text-[#f1d04b]">
                  {profileDraft.name}
                </h1>
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#2563eb] text-white">
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8.5 12.5L10.8 14.8L15.5 10.1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </div>
              <p className="mt-2 text-lg text-neutral-600 dark:text-[#c7ba81]">{profileDraft.email}</p>
              <p className="mt-3 text-sm uppercase tracking-[0.24em] text-neutral-400 dark:text-[#8e7727]">
                {user.role ?? "user"}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[24px] border border-neutral-200 bg-white p-6 dark:border-[#2f2a16] dark:bg-[#0a0a09]">
          <h2 className="text-2xl font-semibold text-[#111] dark:text-[#f1d04b]">{t("myProfile")}</h2>
          <p className="mt-1 text-sm text-neutral-500 dark:text-[#c7ba81]">Manage and protect your account.</p>
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_240px]">
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm text-neutral-500 dark:text-[#c7ba81]">{t("fullName")}</span>
                  <input className="h-12 w-full rounded-xl border border-neutral-300 px-4 dark:border-[#d9b92f] dark:bg-[#080808]" value={profileDraft.name} onChange={(event) => setProfileDraft((current) => ({ ...current, name: event.target.value }))} />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm text-neutral-500 dark:text-[#c7ba81]">{t("email")}</span>
                  <input className="h-12 w-full rounded-xl border border-neutral-300 px-4 dark:border-[#d9b92f] dark:bg-[#080808]" value={profileDraft.email} onChange={(event) => setProfileDraft((current) => ({ ...current, email: event.target.value }))} />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm text-neutral-500 dark:text-[#c7ba81]">{t("phoneNumber")}</span>
                  <input className="h-12 w-full rounded-xl border border-neutral-300 px-4 dark:border-[#d9b92f] dark:bg-[#080808]" value={profileDraft.phone} onChange={(event) => setProfileDraft((current) => ({ ...current, phone: event.target.value }))} />
                </label>
              </div>
              <button type="button" className="rounded-xl bg-[#f15a2b] px-5 py-3 text-sm font-semibold text-white" onClick={saveProfile}>Save</button>
              {profileMessage ? <p className="text-sm text-neutral-600 dark:text-[#c7ba81]">{profileMessage}</p> : null}
            </div>
            <div className="flex flex-col items-center justify-center rounded-[20px] border border-neutral-200 p-6 text-center dark:border-[#2c2817]">
              <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-[#f1f1f1] text-neutral-400 dark:bg-[#171711] dark:text-[#8e7727]">
                {profileImage ? (
                  <img src={profileImage} alt={profileDraft.name} className="h-full w-full object-cover" />
                ) : (
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-14 w-14" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17 20C17 17.791 14.761 16 12 16C9.239 16 7 17.791 7 20" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="12" cy="9" r="3.6" stroke="currentColor" strokeWidth="1.7" />
                  </svg>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={handleImageSelect}
              />
              <button
                type="button"
                className="mt-5 rounded-xl border border-neutral-300 px-4 py-2 text-sm dark:border-[#d9b92f]"
                onClick={() => fileInputRef.current?.click()}
              >
                Select Image
              </button>
              {profileImage ? (
                <button
                  type="button"
                  className="mt-3 rounded-xl border border-[#f15a2b] px-4 py-2 text-sm font-medium text-[#f15a2b] dark:border-[#f0d34f] dark:text-[#f0d34f]"
                  onClick={removeProfileImage}
                >
                  Remove Image
                </button>
              ) : null}
              <p className="mt-4 text-xs text-neutral-500 dark:text-[#c7ba81]">File size: maximum 1 MB</p>
              <p className="text-xs text-neutral-500 dark:text-[#c7ba81]">File extension: JPEG, PNG</p>
            </div>
          </div>
        </div>

        <div className="rounded-[24px] border border-neutral-200 bg-white p-5 dark:border-[#2c2817] dark:bg-[#0a0a09]">
          <h2 className="text-xl font-semibold text-[#111] dark:text-[#f1d04b]">{t("personalDetails")}</h2>
          <div className="mt-5 overflow-hidden rounded-[20px] border border-neutral-200 dark:border-[#2c2817]">
            {profileDetails.map((detail) => (
              <div
                key={detail.label}
                className="grid gap-2 border-b border-neutral-200 px-4 py-4 text-sm last:border-b-0 dark:border-[#2c2817] md:grid-cols-[220px_1fr]"
              >
                <p className="text-neutral-500 dark:text-[#9f9156]">{detail.label}</p>
                <p className="font-medium text-[#111] dark:text-[#f1d04b]">{detail.value}</p>
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
                  <img src={profileImage} alt={profileDraft.name} className="h-full w-full object-cover" />
                ) : (
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-9 w-9" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17 20C17 17.791 14.761 16 12 16C9.239 16 7 17.791 7 20" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="12" cy="9" r="3.4" stroke="currentColor" strokeWidth="1.7" />
                  </svg>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate font-semibold text-[#111] dark:text-[#f1d04b]">{user.name ?? "twis3"}</p>
                <p className="truncate text-sm text-neutral-500 dark:text-[#c7ba81]">Edit Profile</p>
              </div>
            </div>

            <div className="mt-8 space-y-4">
              {menuSections.map((menu) => (
                <div key={menu.id}>
                  <button
                    type="button"
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left font-semibold transition ${
                      section === menu.id || menu.children?.some((child) => child.id === section)
                        ? "bg-neutral-100 text-[#111] dark:bg-[#141412] dark:text-[#f1d04b]"
                        : "text-[#111] dark:text-[#f1d04b]"
                    }`}
                    onClick={() => setSection(menu.id)}
                  >
                    {menu.id === "profile" ? (
                      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M17 20C17 17.791 14.761 16 12 16C9.239 16 7 17.791 7 20" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                        <circle cx="12" cy="9" r="3" stroke="currentColor" strokeWidth="1.7" />
                      </svg>
                    ) : null}
                    {menu.id === "orders" ? (
                      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M4 7.5H20" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                        <path d="M6.5 4.5H17.5V19.5H6.5V4.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                        <path d="M9 10.5H15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                        <path d="M9 14.5H13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                      </svg>
                    ) : null}
                    {menu.id === "notifications" ? (
                      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M14.857 17H9.143M18 17V11C18 8.239 15.761 6 13 6H11C8.239 6 6 8.239 6 11V17L4 19H20L18 17Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M10.5 19C10.764 19.622 11.332 20 12 20C12.668 20 13.236 19.622 13.5 19" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : null}
                    <span>{menu.title}</span>
                  </button>
                  {menu.children && (section === menu.id || menu.children.some((child) => child.id === section)) ? (
                    <div className="mt-2 space-y-1 pl-4">
                      {menu.children.map((child) => (
                        <button
                          key={child.id}
                          type="button"
                          className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                            section === child.id
                              ? "text-[#f15a2b] dark:text-[#f0d34f]"
                              : "text-neutral-600 dark:text-[#c7ba81]"
                          }`}
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
            <p className="text-sm text-neutral-500 dark:text-[#9f9156]">{t("accountProfile")}</p>
            <div className="mt-6">{renderContent()}</div>
          </div>
        </div>
      </section>
    </main>
  );
}
