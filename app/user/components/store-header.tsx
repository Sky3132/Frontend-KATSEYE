"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import ThemeToggle from "../../components/theme-toggle";
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
  onCartClick?: () => void;
};

const NOTIFICATIONS_KEY = "katseye_notifications";
const NOTIFICATIONS_EVENT = "katseye:notifications";
const THEME_EVENT = "katseye:theme";
const THEME_STORAGE_KEY = "katseye-theme";
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
const notificationMeta = [
  { tone: "violet", label: "New Order Received", description: "You have a new order worth $256.", icon: "bell" },
  { tone: "rose", label: "Payment Failed", description: "A payment was failed.", icon: "x" },
  { tone: "amber", label: "Account Update", description: "Account has been updated.", icon: "gear" },
  { tone: "emerald", label: "Feature Announcement", description: "New feature released: Enhanced reporting.", icon: "info" },
] as const;

const navItems = [
  { label: "Home", href: "/" },
  { label: "Shop", href: "/user/products" },
  { label: "Album", href: "/user/products/albums" },
  { label: "Orders", href: "/user/history" },
] as const;

const productGroups = [
  {
    title: "Cloth",
    items: ["T-Shirts", "Hoodies", "Caps"],
  },
  {
    title: "Accessories",
    items: [
      "Keychain",
      "Photo Strip",
      "Wrapping Paper",
      "Slogan Muffler",
    ],
  },
] as const;

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
  const navRef = useRef<HTMLDivElement | null>(null);
  const [productsOpen, setProductsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [isDarkTheme, setIsDarkTheme] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(THEME_STORAGE_KEY) === "dark";
  });
  const notifications = useSyncExternalStore(
    subscribeBrowserState,
    readStoredNotifications,
    () => EMPTY_NOTIFICATIONS,
  );

  useEffect(() => {
    const syncTheme = () => {
      setIsDarkTheme(window.localStorage.getItem(THEME_STORAGE_KEY) === "dark");
    };

    syncTheme();
    window.addEventListener(THEME_EVENT, syncTheme);
    window.addEventListener("storage", syncTheme);
    return () => {
      window.removeEventListener(THEME_EVENT, syncTheme);
      window.removeEventListener("storage", syncTheme);
    };
  }, []);

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

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!navRef.current?.contains(event.target as Node)) {
        setProductsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const unreadCount = useMemo(() => notifications.filter((item) => !item.read).length, [notifications]);

  const openNotifications = () => {
    setNotifOpen(true);
    setProfileOpen(false);
    setProductsOpen(false);
    writeNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
  };

  const closeNotifications = () => {
    setNotifOpen(false);
  };

  const openProfile = () => {
    setProfileOpen((prev) => !prev);
    setNotifOpen(false);
    setProductsOpen(false);
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

  const handleCartOpen = () => {
    if (onCartClick) {
      onCartClick();
      return;
    }
    router.push("/user/cart");
  };

  const getDropdownHref = (groupTitle: string, item: string) => {
    if (groupTitle === "Cloth" && item === "Hoodies") return "/user/products/category/hoodies";
    if (groupTitle === "Cloth" && item === "T-Shirts") return "/user/products/category/t-shirts";
    if (groupTitle === "Cloth" && item === "Caps") return "/user/products/category/caps";
    if (groupTitle === "Accessories" && item === "Keychain") return "/user/products/category/keychain";
    if (groupTitle === "Accessories" && item === "Photo Strip") return "/user/products/category/photo-strip";
    if (groupTitle === "Accessories" && item === "Wrapping Paper") return "/user/products/category/wrapping-paper";
    if (groupTitle === "Accessories" && item === "Slogan Muffler") return "/user/products/category/slogan-muffler";
    if (groupTitle === "Accessories") return "/user/products/category/accessories";
    return "/user/products";
  };

  return (
    <header className="sticky top-0 z-30 bg-[var(--background)] px-4 py-3 sm:px-6">
      <div className="grid w-full grid-cols-1 gap-4 rounded-[24px] border border-black/5 bg-[#e5e5e5] px-4 py-3 shadow-sm transition-colors dark:border-[#2b2613] dark:bg-[linear-gradient(180deg,#050505_0%,#0a0a09_100%)] dark:shadow-[0_0_0_1px_rgba(214,183,54,0.06)] sm:px-5 xl:grid-cols-[auto_1fr_auto] xl:items-center">
        <div className="min-w-0">
          <Link href="/user/products" className="flex min-w-0 items-center gap-3 text-xl font-semibold leading-none tracking-tight text-[#111] dark:text-[#f0d34f] sm:text-3xl">
            <img
              src={isDarkTheme ? "/black logo.jpg" : "/logo_Black-Photoroom.png"}
              alt="Katseye logo"
              className="h-10 w-10 rounded-full object-cover sm:h-11 sm:w-11"
            />
            <span className="truncate">Katseye Klothes</span>
          </Link>
        </div>

        <div ref={navRef} className="relative flex justify-center xl:px-6">
          <nav className="flex flex-wrap items-center justify-center gap-1 rounded-[22px] border border-black/5 bg-[#f7f7f7] p-1.5 transition-colors dark:border-[#2b2613] dark:bg-[#141412]">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`rounded-full px-3 py-2 text-[11px] font-medium uppercase tracking-[0.14em] transition sm:px-4 ${
                  pathname === item.href
                    ? "bg-white text-black dark:bg-[#090909] dark:text-[#f0d34f]"
                    : "text-black hover:bg-white dark:text-[#f0d34f] dark:hover:bg-[#090909]"
                }`}
              >
                {item.label}
              </Link>
            ))}
            <button
              type="button"
              onClick={() => {
                setProductsOpen((prev) => !prev);
                setNotifOpen(false);
                setProfileOpen(false);
              }}
              className={`flex items-center gap-2 rounded-full px-3 py-2 text-[11px] font-medium uppercase tracking-[0.14em] transition sm:px-4 ${
                pathname.startsWith("/user/products") || productsOpen
                  ? "bg-white text-black dark:bg-[#090909] dark:text-[#f0d34f]"
                  : "text-black hover:bg-white dark:text-[#f0d34f] dark:hover:bg-[#090909]"
              }`}
            >
              <span>Our Product</span>
              <svg
                aria-hidden="true"
                viewBox="0 0 12 12"
                className={`h-3 w-3 transition-transform ${productsOpen ? "rotate-180" : ""}`}
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </nav>

          {productsOpen ? (
            <div className="absolute left-1/2 top-[calc(100%+12px)] z-20 w-max max-w-[96vw] -translate-x-1/2 rounded-[20px] border border-neutral-200 bg-white p-5 text-black shadow-[0_20px_60px_rgba(0,0,0,0.16)] dark:border-[#3a3112] dark:bg-[#070707] dark:text-[#f0d34f] dark:shadow-[0_24px_70px_rgba(0,0,0,0.75)] sm:p-6">
              <div className="flex flex-col gap-6 md:flex-row md:flex-wrap md:items-start md:gap-10">
                {productGroups.map((group) => (
                  <div key={group.title} className="min-w-[240px]">
                    <p className="mb-3 text-lg font-semibold text-black dark:text-[#f0d34f]">
                      {group.title}
                    </p>
                    <div className="space-y-1">
                      {group.items.map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => {
                            setProductsOpen(false);
                            router.push(getDropdownHref(group.title, item));
                          }}
                          className="block w-full rounded-md px-1 py-1 text-left text-base text-neutral-700 transition hover:text-black dark:text-[#ceb865] dark:hover:text-[#f7db63]"
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="relative flex flex-wrap items-center justify-start gap-2 xl:justify-end sm:gap-3">
          <ThemeToggle className="h-10 px-3 dark:border-[#d6b736] dark:bg-[#060606] sm:h-11" />

          <button
            type="button"
            onMouseEnter={openNotifications}
            onFocus={openNotifications}
            aria-label="Notifications"
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-black bg-transparent text-black transition-colors dark:border-[#d6b736] dark:bg-[#060606] dark:text-[#f0d34f] sm:h-11 sm:w-11"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
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
            {unreadCount > 0 ? (
              <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[9px] font-semibold text-white dark:bg-[#f0d34f] dark:text-[#090909]">
                {unreadCount}
              </span>
            ) : null}
          </button>

          <button
            type="button"
            onClick={handleCartOpen}
            aria-label="Cart"
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-black bg-transparent text-black transition-colors dark:border-[#d6b736] dark:bg-[#060606] dark:text-[#f0d34f] sm:h-11 sm:w-11"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M3 5H5L7.2 14.2C7.309 14.667 7.814 15 8.293 15H17.4C17.867 15 18.275 14.683 18.391 14.231L20 8H6"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="9" cy="19" r="1.5" fill="currentColor" />
              <circle cx="17" cy="19" r="1.5" fill="currentColor" />
            </svg>
            <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-black px-1 text-[9px] font-semibold text-white dark:bg-[#f0d34f] dark:text-[#090909]">
              {cartCount}
            </span>
          </button>

          <button
            type="button"
            onClick={openProfile}
            aria-label="Profile"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-black bg-transparent text-black transition-colors dark:border-[#d6b736] dark:bg-[#060606] dark:text-[#f0d34f] sm:h-11 sm:w-11"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M17 20C17 17.791 14.761 16 12 16C9.239 16 7 17.791 7 20"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="9" r="3" stroke="currentColor" strokeWidth="1.7" />
            </svg>
          </button>

          {notifOpen ? (
            <div
              className="absolute right-32 top-14 w-[380px] overflow-hidden rounded-[24px] border border-neutral-200 bg-white shadow-xl dark:border-[#3a3112] dark:bg-[#090909]"
              onMouseLeave={closeNotifications}
            >
              <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4 dark:border-[#2c2817]">
                <p className="text-lg font-semibold text-black dark:text-[#f0d34f]">Notifications</p>
                <button
                  type="button"
                  aria-label="Close notifications"
                  className="grid h-7 w-7 place-items-center rounded-full border border-neutral-200 text-sm text-neutral-500 dark:border-[#2c2817] dark:text-[#cfbd78]"
                  onClick={closeNotifications}
                >
                  ×
                </button>
              </div>

              <div className="max-h-[420px] overflow-auto">
                {(notifications.length > 0 ? notifications : feedMessages.map((message, index) => ({
                  id: `seed-${index}`,
                  message,
                  createdAt: new Date().toISOString(),
                  read: true,
                }))).slice(0, 6).map((item, index) => {
                  const meta = notificationMeta[index % notificationMeta.length];
                  const toneClasses =
                    meta.tone === "violet"
                      ? "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300"
                      : meta.tone === "rose"
                        ? "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300"
                        : meta.tone === "amber"
                          ? "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300"
                          : "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300";

                  return (
                    <div
                      key={item.id}
                      className="flex items-start gap-4 border-b border-neutral-200 px-5 py-4 dark:border-[#2c2817]"
                    >
                      <div className={`mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${toneClasses}`}>
                        {meta.icon === "bell" ? (
                          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M14.857 17H9.143M18 17V11C18 8.239 15.761 6 13 6H11C8.239 6 6 8.239 6 11V17L4 19H20L18 17Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : null}
                        {meta.icon === "x" ? (
                          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M15 9L9 15M9 9L15 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                            <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
                          </svg>
                        ) : null}
                        {meta.icon === "gear" ? (
                          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 9.5A2.5 2.5 0 1 0 12 14.5A2.5 2.5 0 1 0 12 9.5Z" stroke="currentColor" strokeWidth="1.8" />
                            <path d="M19 12C19 11.523 18.94 11.061 18.826 10.621L20.5 9.25L18.75 6.25L16.72 7.02C16.05 6.47 15.275 6.045 14.426 5.783L14.1 3.75H9.9L9.574 5.783C8.725 6.045 7.95 6.47 7.28 7.02L5.25 6.25L3.5 9.25L5.174 10.621C5.06 11.061 5 11.523 5 12C5 12.477 5.06 12.939 5.174 13.379L3.5 14.75L5.25 17.75L7.28 16.98C7.95 17.53 8.725 17.955 9.574 18.217L9.9 20.25H14.1L14.426 18.217C15.275 17.955 16.05 17.53 16.72 16.98L18.75 17.75L20.5 14.75L18.826 13.379C18.94 12.939 19 12.477 19 12Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : null}
                        {meta.icon === "info" ? (
                          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 10V16M12 7H12.01M20 12C20 16.418 16.418 20 12 20C7.582 20 4 16.418 4 12C4 7.582 7.582 4 12 4C16.418 4 20 7.582 20 12Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-base font-medium text-black dark:text-[#f0d34f]">
                              {meta.label}
                            </p>
                            <p className="mt-1 text-sm text-neutral-500 dark:text-[#cfbd78]">
                              {item.message || meta.description}
                            </p>
                          </div>
                          <span className="shrink-0 text-xs text-neutral-400 dark:text-[#8e7727]">
                            2 min ago
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                className="w-full px-5 py-4 text-center text-base font-semibold text-[#5647ff] transition hover:bg-neutral-50 dark:text-[#f0d34f] dark:hover:bg-[#11110f]"
                onClick={() => router.push("/user/history")}
              >
                View All Notifications
              </button>
            </div>
          ) : null}

          {profileOpen ? (
            <div className="absolute right-0 top-14 w-[280px] rounded-xl border border-neutral-200 bg-white p-3 shadow-xl dark:border-[#f1d04b]/20 dark:bg-[#0e0e0d] dark:text-[#f1d04b]">
              <p className="text-xs uppercase tracking-wide text-neutral-500 dark:text-[#bba95e]">My Account</p>
              <p className="mt-1 break-all text-sm font-medium">{email}</p>
              <div className="mt-3 space-y-2">
                <button
                  type="button"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-left text-sm dark:border-[#f1d04b]/25 dark:bg-[#141412]"
                  onClick={() => router.push("/user/account")}
                >
                  My Account
                </button>
                <button
                  type="button"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-left text-sm dark:border-[#f1d04b]/25 dark:bg-[#141412]"
                  onClick={() => router.push("/user/account?tab=reset")}
                >
                  Reset Password
                </button>
                <button
                  type="button"
                  className="w-full rounded-lg bg-black px-3 py-2 text-left text-sm text-white dark:bg-[#f1d04b] dark:text-[#090909]"
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
