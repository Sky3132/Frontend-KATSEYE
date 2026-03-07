"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { getNotifyEventName } from "../lib/cart";
import {
  authenticatedFetch,
  clearStoredAuth,
  USER_STORAGE_KEY,
} from "../../lib/auth";

type NotificationItem = {
  id: string;
  message: string;
  createdAt: string;
  read: boolean;
};

type StoreHeaderProps = {
  cartCount: number;
  onCartClick: () => void;
};

const NOTIFICATIONS_KEY = "katseye_notifications";
const NOTIFICATIONS_EVENT = "katseye:notifications";
const LOGOUT_API_URL = "http://localhost:3002/auth/users/logout";
const EMPTY_NOTIFICATIONS: NotificationItem[] = [];
const DEFAULT_EMAIL = "user@example.com";
let cachedEmailRaw: string | null = null;
let cachedEmailSnapshot = DEFAULT_EMAIL;
let cachedNotificationsRaw: string | null = null;
let cachedNotificationsSnapshot: NotificationItem[] = EMPTY_NOTIFICATIONS;
const feedMessages = [
  "New drop: Limited hoodie colorway is now available.",
  "Shipping promo active for orders above $75.",
  "Your wishlist item just got restocked.",
  "Style alert: Matching accessories added.",
];

const readStoredEmail = () => {
  if (typeof window === "undefined") return DEFAULT_EMAIL;

  try {
    const rawUser = localStorage.getItem(USER_STORAGE_KEY);
    if (rawUser === cachedEmailRaw) return cachedEmailSnapshot;
    if (!rawUser) {
      cachedEmailRaw = null;
      cachedEmailSnapshot = DEFAULT_EMAIL;
      return cachedEmailSnapshot;
    }

    const parsed = JSON.parse(rawUser) as { email?: string };
    cachedEmailRaw = rawUser;
    cachedEmailSnapshot = parsed?.email ?? DEFAULT_EMAIL;
    return cachedEmailSnapshot;
  } catch {
    cachedEmailRaw = null;
    cachedEmailSnapshot = DEFAULT_EMAIL;
    return cachedEmailSnapshot;
  }
};

const readStoredNotifications = (): NotificationItem[] => {
  if (typeof window === "undefined") return EMPTY_NOTIFICATIONS;

  try {
    const raw = localStorage.getItem(NOTIFICATIONS_KEY);
    if (raw === cachedNotificationsRaw) return cachedNotificationsSnapshot;
    if (!raw) {
      cachedNotificationsRaw = null;
      cachedNotificationsSnapshot = EMPTY_NOTIFICATIONS;
      return cachedNotificationsSnapshot;
    }

    const parsed = JSON.parse(raw) as NotificationItem[];
    cachedNotificationsRaw = raw;
    cachedNotificationsSnapshot = Array.isArray(parsed) ? parsed : EMPTY_NOTIFICATIONS;
    return cachedNotificationsSnapshot;
  } catch {
    cachedNotificationsRaw = null;
    cachedNotificationsSnapshot = EMPTY_NOTIFICATIONS;
    return cachedNotificationsSnapshot;
  }
};

const subscribeBrowserState = (callback: () => void) => {
  if (typeof window === "undefined") return () => {};

  const handleChange = () => callback();
  window.addEventListener("storage", handleChange);
  window.addEventListener(NOTIFICATIONS_EVENT, handleChange);

  return () => {
    window.removeEventListener("storage", handleChange);
    window.removeEventListener(NOTIFICATIONS_EVENT, handleChange);
  };
};

const writeNotifications = (
  updater: NotificationItem[] | ((current: NotificationItem[]) => NotificationItem[]),
) => {
  if (typeof window === "undefined") return;

  const current = readStoredNotifications();
  const next = typeof updater === "function" ? updater(current) : updater;
  localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(NOTIFICATIONS_EVENT));
};

export default function StoreHeader({ cartCount, onCartClick }: StoreHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const email = useSyncExternalStore(subscribeBrowserState, readStoredEmail, () => DEFAULT_EMAIL);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifications = useSyncExternalStore(
    subscribeBrowserState,
    readStoredNotifications,
    () => EMPTY_NOTIFICATIONS,
  );

  useEffect(() => {
    const eventName = getNotifyEventName();
    const handler = (event: Event) => {
      const custom = event as CustomEvent<{ message?: string }>;
      const message = custom.detail?.message ?? "Store update";
      writeNotifications((prev) => [
        { id: crypto.randomUUID(), message, createdAt: new Date().toISOString(), read: false },
        ...prev,
      ]);
    };

    window.addEventListener(eventName, handler);
    return () => window.removeEventListener(eventName, handler);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const message = feedMessages[Math.floor(Math.random() * feedMessages.length)];
      writeNotifications((prev) => [
        { id: crypto.randomUUID(), message, createdAt: new Date().toISOString(), read: false },
        ...prev.slice(0, 11),
      ]);
    }, 20000);

    return () => window.clearInterval(timer);
  }, []);

  const unreadCount = useMemo(() => notifications.filter((item) => !item.read).length, [notifications]);

  const openNotifications = () => {
    setNotifOpen((prev) => !prev);
    setProfileOpen(false);
    writeNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
  };

  const openProfile = () => {
    setProfileOpen((prev) => !prev);
    setNotifOpen(false);
  };

  const logout = async () => {
    try {
      await authenticatedFetch(LOGOUT_API_URL, {
        method: "POST",
      });
    } catch {
      // even if API fails, continue local logout
    }
    clearStoredAuth();
    localStorage.removeItem("katseye_cart");
    localStorage.removeItem(NOTIFICATIONS_KEY);
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white">
      <div className="mx-auto flex min-h-20 w-full max-w-[1400px] flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-8">
          <Link href="/user/products" className="text-4xl font-semibold leading-none tracking-tight">
            Katseye Klothes
          </Link>
          <nav className="flex flex-wrap items-center gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 p-1">
            <Link
              href="/user/products"
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                pathname.startsWith("/user/products")
                  ? "bg-black text-white"
                  : "text-neutral-600 hover:bg-white hover:text-black"
              }`}
            >
              Products
            </Link>
            <Link
              href="/user/history"
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                pathname.startsWith("/user/history")
                  ? "bg-black text-white"
                  : "text-neutral-600 hover:bg-white hover:text-black"
              }`}
            >
              History
            </Link>
          </nav>
        </div>

        <div className="relative flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={openNotifications}
            className="relative rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium"
          >
            Notifications
            {unreadCount > 0 ? (
              <span className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                {unreadCount}
              </span>
            ) : null}
          </button>

          <button
            type="button"
            onClick={onCartClick}
            className="relative rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium"
          >
            Cart
            <span className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-black px-1 text-[10px] font-semibold text-white">
              {cartCount}
            </span>
          </button>

          <button
            type="button"
            onClick={openProfile}
            className="rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium"
          >
            Profile
          </button>

          {notifOpen ? (
            <div className="absolute right-32 top-14 w-[340px] rounded-xl border border-neutral-200 bg-white p-3 shadow-xl">
              <p className="mb-2 text-sm font-semibold">Live Notifications</p>
              <div className="max-h-72 space-y-2 overflow-auto">
                {notifications.length === 0 ? (
                  <p className="text-sm text-neutral-500">No notifications yet.</p>
                ) : (
                  notifications.map((item) => (
                    <div key={item.id} className="rounded-lg border border-neutral-200 p-2">
                      <p className="text-sm text-neutral-800">{item.message}</p>
                      <p className="mt-1 text-xs text-neutral-500">
                        {new Date(item.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}

          {profileOpen ? (
            <div className="absolute right-0 top-14 w-[280px] rounded-xl border border-neutral-200 bg-white p-3 shadow-xl">
              <p className="text-xs uppercase tracking-wide text-neutral-500">My Account</p>
              <p className="mt-1 break-all text-sm font-medium">{email}</p>
              <div className="mt-3 space-y-2">
                <button
                  type="button"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-left text-sm"
                  onClick={() => router.push("/user/account")}
                >
                  My Account
                </button>
                <button
                  type="button"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-left text-sm"
                  onClick={() => router.push("/user/account?tab=reset")}
                >
                  Reset Password
                </button>
                <button
                  type="button"
                  className="w-full rounded-lg bg-black px-3 py-2 text-left text-sm text-white"
                  onClick={logout}
                >
                  Logout
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
