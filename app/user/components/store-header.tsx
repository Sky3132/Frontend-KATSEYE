"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import ThemeToggle from "../../components/theme-toggle";
import { getCartServerSnapshot, getNotifyEventName, readCart, subscribeCart } from "../lib/cart";
import { notificationImages } from "../lib/account-content";
import { syncUserNotifications } from "../lib/notification-sync";
import { fetchProducts, type Product as CatalogProduct } from "../lib/catalog-api";
import { fetchCategoriesTree, type CategoryNode } from "../lib/categories-api";
import {
  CURRENCY_STORAGE_KEY,
  currencyOptions,
  emitStoreSettingsChange,
  LANGUAGE_STORAGE_KEY,
  languageOptions,
  useStoreSettings,
} from "../lib/store-settings";
import {
  logoutUser,
  USER_STORAGE_KEY,
} from "../../lib/auth";

type NotificationItem = {
  id: string;
  message: string;
  createdAt: string;
  read: boolean;
  image?: string;
  productId?: string;
};

type ToastItem = {
  id: string;
  message: string;
};

type StoredUser = {
  name?: string;
  email?: string;
  avatar?: string;
};

type StoreHeaderProps = {
  cartCount: number;
  onCartClick?: () => void;
};

const NOTIFICATIONS_KEY = "katseye_notifications";
const NOTIFICATIONS_EVENT = "katseye:notifications";
const THEME_EVENT = "katseye:theme";
const THEME_STORAGE_KEY = "katseye-theme";
const EMPTY_NOTIFICATIONS: NotificationItem[] = [];
const DEFAULT_USER: StoredUser = {
  name: "Your name",
  email: "yourname@gmail.com",
  avatar: "",
};
let cachedUserRaw: string | null = null;
let cachedUserSnapshot = DEFAULT_USER;
let cachedNotificationsRaw: string | null = null;
let cachedNotificationsSnapshot: NotificationItem[] = EMPTY_NOTIFICATIONS;

const navItems = [
  { label: "Home", href: "/" },
  { label: "Shop", href: "/user/products" },
  { label: "Album", href: "/user/products/albums" },
] as const;

const DEFAULT_CATEGORY_GROUPS: CategoryNode[] = [];

const readStoredUser = () => {
  if (typeof window === "undefined") return DEFAULT_USER;

  try {
    const rawUser = localStorage.getItem(USER_STORAGE_KEY);
    if (rawUser === cachedUserRaw) return cachedUserSnapshot;
    if (!rawUser) {
      cachedUserRaw = null;
      cachedUserSnapshot = DEFAULT_USER;
      return cachedUserSnapshot;
    }

    const parsed = JSON.parse(rawUser) as StoredUser;
    cachedUserRaw = rawUser;
    cachedUserSnapshot = {
      name: parsed?.name ?? DEFAULT_USER.name,
      email: parsed?.email ?? DEFAULT_USER.email,
      avatar: parsed?.avatar ?? DEFAULT_USER.avatar,
    };
    return cachedUserSnapshot;
  } catch {
    cachedUserRaw = null;
    cachedUserSnapshot = DEFAULT_USER;
    return cachedUserSnapshot;
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
  const user = useSyncExternalStore(subscribeBrowserState, readStoredUser, () => DEFAULT_USER);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const navRef = useRef<HTMLDivElement | null>(null);
  const [productsOpen, setProductsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const [currencyMenuOpen, setCurrencyMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [cartPreviewOpen, setCartPreviewOpen] = useState(false);
  const [toast, setToast] = useState<ToastItem | null>(null);
  const [notificationNowMs, setNotificationNowMs] = useState<number>(() => Date.now());
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const [categoryGroups, setCategoryGroups] = useState<CategoryNode[]>(DEFAULT_CATEGORY_GROUPS);
  const [isDarkTheme, setIsDarkTheme] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(THEME_STORAGE_KEY) === "dark";
  });
  const [language, setLanguage] = useState(() => {
    if (typeof window === "undefined") return "English";
    return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) ?? "English";
  });
  const [currency, setCurrency] = useState(() => {
    if (typeof window === "undefined") return "PHP";
    return window.localStorage.getItem(CURRENCY_STORAGE_KEY) ?? "PHP";
  });
  const notifications = useSyncExternalStore(
    subscribeBrowserState,
    readStoredNotifications,
    () => EMPTY_NOTIFICATIONS,
  );
  const cartItems = useSyncExternalStore(subscribeCart, readCart, getCartServerSnapshot);
  const { formatCurrency, t, translateCategoryText } = useStoreSettings();

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

  const menuCategoryGroups = useMemo(() => {
    const uniqueBySlug = (nodes: CategoryNode[]) => {
      const seen = new Set<string>();
      return nodes.filter((node) => {
        if (!node.slug) return false;
        if (seen.has(node.slug)) return false;
        seen.add(node.slug);
        return true;
      });
    };

    const normalizeChildren = (group: CategoryNode) => {
      const children = uniqueBySlug(group.children)
        .filter((child) => child.slug !== group.slug)
        .filter((child) => !/^all-/.test(child.slug))
        .filter((child) => !child.name.toLowerCase().startsWith("all "))
        .sort((a, b) => a.name.localeCompare(b.name));
      return { ...group, children };
    };

    const normalized = uniqueBySlug(categoryGroups)
      .filter((group) => !/^all-/.test(group.slug))
      .filter((group) => group.children.length > 0)
      .map(normalizeChildren);

    const preferredOrder = ["apparel", "accessories"];
    return normalized.sort((a, b) => {
      const aIndex = preferredOrder.indexOf(a.slug);
      const bIndex = preferredOrder.indexOf(b.slug);
      if (aIndex !== -1 || bIndex !== -1) {
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      }
      return a.name.localeCompare(b.name);
    });
  }, [categoryGroups]);

  useEffect(() => {
    let cancelled = false;

    fetchProducts()
      .then((items) => {
        if (cancelled) return;
        setCatalogProducts(items);
      })
      .catch(() => {
        if (cancelled) return;
        setCatalogProducts([]);
      });

    fetchCategoriesTree()
      .then((items) => {
        if (cancelled) return;
        setCategoryGroups(items);
      })
      .catch(() => {
        if (cancelled) return;
        setCategoryGroups([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const tick = async () => {
      try {
        await syncUserNotifications();
      } catch {
        // Ignore polling failures; we'll try again on the next interval.
      }
    };

    void tick();
    timer = setInterval(() => {
      if (cancelled) return;
      void tick();
    }, 90_000);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const eventName = getNotifyEventName();
    const handler = (event: Event) => {
      const custom = event as CustomEvent<{ message?: string; image?: string; productId?: string }>;
      const message = custom.detail?.message ?? "Store update";
      const image = custom.detail?.image;
      const productId = custom.detail?.productId;
      const normalized = message.toLowerCase();
      writeNotifications((prev) => [
        { id: crypto.randomUUID(), message, createdAt: new Date().toISOString(), read: false, image, productId },
        ...prev,
      ]);

      if (
        normalized.includes("added to cart") ||
        normalized.includes("new product") ||
        normalized.includes("new products") ||
        normalized.includes("just dropped")
      ) {
        setToast({ id: crypto.randomUUID(), message });
      }
    };

    window.addEventListener(eventName, handler);
    return () => window.removeEventListener(eventName, handler);
  }, []);

  useEffect(() => {
    if (!toast) return;

    const timer = window.setTimeout(() => {
      setToast((current) => (current?.id === toast.id ? null : current));
    }, 2600);

    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) {
        setProductsOpen(false);
        setProfileOpen(false);
        setSettingsOpen(false);
        setNotifOpen(false);
        setCartPreviewOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const unreadCount = useMemo(() => notifications.filter((item) => !item.read).length, [notifications]);

  const openNotifications = () => {
    setNotifOpen(true);
    setProfileOpen(false);
    setSettingsOpen(false);
    setProductsOpen(false);
    setCartPreviewOpen(false);
    setNotificationNowMs(Date.now());
    writeNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
  };

  const closeNotifications = () => {
    setNotifOpen(false);
  };

  useEffect(() => {
    if (!notifOpen) return;
    const timer = window.setInterval(() => setNotificationNowMs(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, [notifOpen]);

  const openProductsMenu = () => {
    setProductsOpen(true);
    setNotifOpen(false);
    setProfileOpen(false);
    setSettingsOpen(false);
    setCartPreviewOpen(false);
  };

  const closeProductsMenu = () => {
    setProductsOpen(false);
  };

  const openCartPreview = () => {
    setCartPreviewOpen(true);
    setNotifOpen(false);
    setProfileOpen(false);
    setSettingsOpen(false);
    setProductsOpen(false);
  };

  const closeCartPreview = () => {
    setCartPreviewOpen(false);
  };

  const openProfile = () => {
    setProfileOpen((prev) => !prev);
    setNotifOpen(false);
    setSettingsOpen(false);
    setProductsOpen(false);
    setCartPreviewOpen(false);
  };

  const openProfilePreview = () => {
    setProfileOpen(true);
    setNotifOpen(false);
    setSettingsOpen(false);
    setProductsOpen(false);
    setCartPreviewOpen(false);
  };

  const closeProfilePreview = () => {
    setProfileOpen(false);
  };

  const openSettings = () => {
    setSettingsOpen(true);
    setLanguageMenuOpen(false);
    setCurrencyMenuOpen(false);
    setProfileOpen(false);
    setNotifOpen(false);
    setProductsOpen(false);
    setCartPreviewOpen(false);
  };

  const logout = async () => {
    await logoutUser();
    localStorage.removeItem(NOTIFICATIONS_KEY);
    window.location.assign("/login?loggedOut=1");
  };

  const handleCartOpen = () => {
    if (onCartClick) {
      onCartClick();
      return;
    }
    setCartPreviewOpen((prev) => {
      const next = !prev;
      if (next) {
        setNotifOpen(false);
        setProfileOpen(false);
        setSettingsOpen(false);
        setProductsOpen(false);
      }
      return next;
    });
  };

  const handleLanguageChange = (value: string) => {
    setLanguage(value);
    setLanguageMenuOpen(false);
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, value);
    emitStoreSettingsChange();
  };

  const handleCurrencyChange = (value: string) => {
    setCurrency(value);
    setCurrencyMenuOpen(false);
    window.localStorage.setItem(CURRENCY_STORAGE_KEY, value);
    emitStoreSettingsChange();
  };

  const getCategoryHref = (node: CategoryNode) => `/user/products/category/${node.slug}`;

  const getNotificationTarget = (message: string, index: number) => {
    const normalized = message.toLowerCase();
    const exactMatch = catalogProducts.find((product) =>
      normalized.includes(product.name.toLowerCase()),
    );
    if (exactMatch) return exactMatch;

    const keywordMatches = [
      { keywords: ["hoodie"], productId: "merch-001" },
      { keywords: ["vinyl"], productId: "music-003" },
      { keywords: ["wishlist", "restocked"], productId: "merch-017" },
      { keywords: ["accessories", "feature"], productId: "merch-014" },
      { keywords: ["payment", "account"], productId: "music-002" },
      { keywords: ["order"], productId: "merch-001" },
    ];

    const keywordMatch = keywordMatches.find(({ keywords }) =>
      keywords.some((keyword) => normalized.includes(keyword)),
    );

    if (keywordMatch) {
      return (
        catalogProducts.find((product) => product.id === keywordMatch.productId) ?? null
      );
    }

    return catalogProducts.length > 0
      ? catalogProducts[index % catalogProducts.length] ?? null
      : null;
  };

  const getNotificationDisplay = (message: string) => {
    const normalized = message.toLowerCase();

    const isOrderCancelled =
      normalized.includes("order") &&
      (normalized.includes("cancelled") ||
        normalized.includes("canceled") ||
        normalized.includes("cancel"));

    const isOrderConfirmed =
      normalized.includes("order confirmed") ||
      normalized.includes("order received") ||
      normalized.includes("order placed") ||
      normalized.includes("you placed an order");

    const isOrderUpdated =
      normalized.includes("order updated") ||
      normalized.includes("updated") ||
      normalized.includes("shipping") ||
      normalized.includes("shipped") ||
      normalized.includes("delivered") ||
      normalized.includes("processing") ||
      normalized.includes("tracking");

    const isPaymentSuccessful =
      normalized.includes("payment successful") ||
      (normalized.includes("payment") && normalized.includes("successful")) ||
      normalized.includes("paid");

    const isReadyForCheckout =
      normalized.includes("ready for checkout") ||
      normalized.includes("ready to checkout") ||
      normalized.includes("left in your cart") ||
      (normalized.includes("checkout") && normalized.includes("ready"));

    const isItemReserved =
      normalized.includes("item reserved") ||
      normalized.includes("reserved") ||
      normalized.includes("low stock") ||
      normalized.includes("almost sold out");

    const isBackInStock =
      normalized.includes("back in stock") ||
      (normalized.includes("back") && normalized.includes("stock")) ||
      normalized.includes("restocked");

    if (isOrderCancelled) {
      return {
        label: "Order Cancelled",
        description: message,
      };
    }

    if (isPaymentSuccessful) {
      return {
        label: "Payment Successful",
        description: message,
      };
    }

    if (isOrderConfirmed) {
      return {
        label: "Order Confirmed",
        description: message,
      };
    }

    if (isReadyForCheckout) {
      return {
        label: "Ready for Checkout",
        description: message,
      };
    }

    if (isItemReserved) {
      return { label: "Item Reserved", description: message };
    }

    if (isBackInStock) {
      return { label: "Back in Stock", description: message };
    }

    if (isOrderUpdated || normalized.includes("order") || normalized.includes("address")) {
      return { label: "Order Updated", description: message };
    }

    return { label: "Order Updated", description: message };
  };

  const formatRelativeTime = (isoTimestamp: string, nowMs: number) => {
    const createdAtMs = Date.parse(isoTimestamp);
    if (!Number.isFinite(createdAtMs)) return "";

    const diffMs = nowMs - createdAtMs;
    if (diffMs < 60_000) return "Just now";
    if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)} min ago`;
    if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)} hr ago`;

    const days = Math.floor(diffMs / 86_400_000);
    return `${days} day${days === 1 ? "" : "s"} ago`;
  };

  return (
    <header className="sticky top-0 z-30 border-b border-black/10 bg-[rgba(255,255,255,0.88)] px-4 py-4 backdrop-blur-xl transition-colors dark:border-[#2b2613] dark:bg-[rgba(5,5,5,0.92)] sm:px-6">
      {toast ? (
        <div className="pointer-events-none fixed right-4 top-24 z-[80] w-[min(92vw,360px)]">
          <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/95 px-4 py-3 text-emerald-950 shadow-[0_16px_40px_rgba(16,185,129,0.22)] backdrop-blur dark:border-emerald-500/30 dark:bg-[#0b1b12]/95 dark:text-emerald-100">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                className="h-5 w-5"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M5 10.5L8.25 13.5L15 6.75"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">Added to cart</p>
              <p className="mt-1 text-sm text-emerald-800/90 dark:text-emerald-200/90">{toast.message}</p>
            </div>
          </div>
        </div>
      ) : null}

      <div ref={headerRef} className="grid w-full grid-cols-1 gap-4 px-1 transition-colors xl:grid-cols-[auto_1fr_auto] xl:items-center">
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
          <nav className="flex flex-wrap items-center justify-center gap-2 px-2 py-1 transition-colors">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition sm:px-4 ${
                  pathname === item.href
                    ? "text-[#111111] underline underline-offset-[8px] dark:text-[#f0d34f]"
                    : "text-black/75 hover:text-black dark:text-[#cfbd78] dark:hover:text-[#f0d34f]"
                }`}
              >
                {item.label === "Home" ? t("home") : item.label === "Shop" ? t("shop") : t("album")}
              </Link>
            ))}
            <button
              type="button"
              onMouseEnter={openProductsMenu}
              onFocus={openProductsMenu}
              onClick={() => {
                setProductsOpen((prev) => !prev);
                setNotifOpen(false);
                setProfileOpen(false);
                setSettingsOpen(false);
                setCartPreviewOpen(false);
              }}
              className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition sm:px-4 ${
                pathname.startsWith("/user/products") || productsOpen
                  ? "text-[#111111] underline underline-offset-[8px] dark:text-[#f0d34f]"
                  : "text-black/75 hover:text-black dark:text-[#cfbd78] dark:hover:text-[#f0d34f]"
              }`}
            >
              <span>{t("ourProduct")}</span>
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
            <div
              className="absolute left-1/2 top-[calc(100%+12px)] z-20 w-max max-w-[96vw] -translate-x-1/2 rounded-[20px] border border-neutral-200 bg-white p-5 text-black shadow-[0_20px_60px_rgba(0,0,0,0.16)] dark:border-[#3a3112] dark:bg-[#070707] dark:text-[#f0d34f] dark:shadow-[0_24px_70px_rgba(0,0,0,0.75)] sm:p-6"
              onMouseEnter={openProductsMenu}
              onMouseLeave={closeProductsMenu}
            >
              <div className="flex flex-col gap-6 md:flex-row md:flex-wrap md:items-start md:gap-10">
                {menuCategoryGroups.map((group) => (
                  <div key={group.id} className="min-w-[240px]">
                    <p className="mb-3 text-lg font-semibold text-black dark:text-[#f0d34f]">
                      {translateCategoryText(group.name)}
                    </p>
                    <div className="space-y-1">
                      <button
                        type="button"
                        onClick={() => {
                          setProductsOpen(false);
                          router.push(getCategoryHref(group));
                        }}
                        className="block w-full rounded-md px-1 py-1 text-left text-base text-neutral-700 transition hover:text-black dark:text-[#ceb865] dark:hover:text-[#f7db63]"
                      >
                        {group.slug === "accessories"
                          ? t("allAccessories")
                          : group.slug === "apparel"
                            ? t("allApparel")
                            : `All ${translateCategoryText(group.name)}`}
                      </button>
                      {group.children.map((child) => (
                        <button
                          key={child.id}
                          type="button"
                          onClick={() => {
                            setProductsOpen(false);
                            router.push(getCategoryHref(child));
                          }}
                          className="block w-full rounded-md px-1 py-1 text-left text-base text-neutral-700 transition hover:text-black dark:text-[#ceb865] dark:hover:text-[#f7db63]"
                        >
                          {translateCategoryText(child.name)}
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
            onMouseEnter={openCartPreview}
            onFocus={openCartPreview}
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

          {cartPreviewOpen ? (
            <div
              className="absolute right-14 top-14 z-30 w-[380px] overflow-hidden rounded-[24px] border border-neutral-200 bg-white shadow-xl dark:border-[#3a3112] dark:bg-[#090909]"
              onMouseEnter={openCartPreview}
              onMouseLeave={closeCartPreview}
            >
              <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4 dark:border-[#2c2817]">
                <p className="text-lg font-semibold text-black dark:text-[#f0d34f]">Cart</p>
                <button
                  type="button"
                  aria-label="Close cart preview"
                  className="grid h-7 w-7 place-items-center rounded-full border border-neutral-200 text-sm text-neutral-500 dark:border-[#2c2817] dark:text-[#cfbd78]"
                  onClick={closeCartPreview}
                >
                  x
                </button>
              </div>

              <div className="max-h-[420px] overflow-auto">
                {cartItems.length > 0 ? (
                  cartItems.slice(0, 6).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="grid w-full grid-cols-[56px_minmax(0,1fr)_92px] items-center gap-4 border-b border-neutral-200 px-5 py-4 text-left transition hover:bg-neutral-50 dark:border-[#2c2817] dark:hover:bg-[#11110f]"
                      onClick={() => {
                        closeCartPreview();
                        router.push(`/user/products/product-details/${item.productId ?? item.id}`);
                      }}
                    >
                      <div className="h-14 w-14 overflow-hidden rounded-xl border border-neutral-200 dark:border-[#2c2817]">
                        {item.image?.trim() ? (
                          <div
                            aria-label={item.name}
                            className="h-full w-full bg-center bg-no-repeat"
                            style={{
                              backgroundImage: `url('${item.image}')`,
                              backgroundSize: "cover",
                            }}
                          />
                        ) : (
                          <div className="grid h-full w-full place-items-center bg-neutral-100 text-xs text-neutral-400 dark:bg-[#0b0b0a] dark:text-[#8e7727]">
                            No image
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-base font-medium text-black dark:text-[#f0d34f]">
                          {item.name}
                        </p>
                        <p className="mt-1 text-sm text-neutral-500 dark:text-[#cfbd78]">
                          {item.size ? `Size ${item.size} • ` : ""}Qty {item.qty}
                        </p>
                      </div>
                      <p className="text-right text-sm font-semibold text-[#f15a2b] dark:text-[#f0d34f]">
                        {formatCurrency(item.price * item.qty)}
                      </p>
                    </button>
                  ))
                ) : (
                  <div className="px-5 py-8 text-center text-sm text-neutral-500 dark:text-[#cfbd78]">
                    Your cart is empty.
                  </div>
                )}
              </div>

              <div className="border-t border-neutral-200 px-5 py-4 dark:border-[#2c2817]">
                <div
                  className={`mb-3 flex items-center gap-4 text-sm text-neutral-500 dark:text-[#cfbd78] ${
                    cartCount > 6 ? "justify-between" : "justify-end"
                  }`}
                >
                  {cartCount > 6 ? <p>{cartCount - 6} More Products In Cart</p> : null}
                  <p>{cartCount} item{cartCount === 1 ? "" : "s"}</p>
                </div>
                <button
                  type="button"
                  className="w-full text-center text-base font-semibold text-[#5647ff] transition hover:bg-neutral-50 dark:text-[#f0d34f] dark:hover:bg-[#11110f]"
                  onClick={() => {
                    closeCartPreview();
                    router.push("/user/cart");
                  }}
                >
                  View My Shopping Cart
                </button>
              </div>
            </div>
          ) : null}

          <button
            type="button"
            onMouseEnter={openProfilePreview}
            onFocus={openProfilePreview}
            onClick={openProfile}
            aria-label="Profile"
            className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-black bg-transparent text-black transition-colors dark:border-[#d6b736] dark:bg-[#060606] dark:text-[#f0d34f] sm:h-11 sm:w-11"
          >
            {user.avatar ? (
              <img src={user.avatar} alt={user.name ?? "Profile"} className="h-full w-full object-cover" />
            ) : (
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
            )}
          </button>

          {notifOpen ? (
            <div
              className="absolute right-32 top-14 w-[380px] overflow-hidden rounded-[24px] border border-neutral-200 bg-white shadow-xl dark:border-[#3a3112] dark:bg-[#090909]"
              onMouseLeave={closeNotifications}
            >
              <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4 dark:border-[#2c2817]">
                <p className="text-lg font-semibold text-black dark:text-[#f0d34f]">{t("notifications")}</p>
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
                {notifications.length === 0 ? (
                  <div className="px-5 py-10 text-center">
                    <p className="text-sm font-semibold text-neutral-800 dark:text-[#f0d34f]">No notifications</p>
                    <p className="mt-2 text-sm text-neutral-500 dark:text-[#cfbd78]">You&apos;re all caught up.</p>
                  </div>
                ) : (
                  notifications.slice(0, 6).map((item, index) => {
                  const meta = getNotificationDisplay(item.message);
                  const targetProduct =
                    item.productId
                      ? catalogProducts.find((product) => product.id === item.productId) ?? null
                      : getNotificationTarget(item.message, index);
                  const relativeTime = formatRelativeTime(item.createdAt, notificationNowMs);

                  return (
                    <button
                      key={item.id}
                      type="button"
                      className="flex w-full items-start gap-4 border-b border-neutral-200 px-5 py-4 text-left transition hover:bg-neutral-50 dark:border-[#2c2817] dark:hover:bg-[#11110f]"
                      onClick={() => {
                        closeNotifications();
                        if (targetProduct) {
                          router.push(`/user/products/product-details/${targetProduct.id}`);
                          return;
                        }
                        router.push("/user/history");
                      }}
                    >
                      <div className="mt-1 h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-neutral-200 dark:border-[#2c2817]">
                        <img
                          src={
                            item.image ??
                            targetProduct?.image ??
                            notificationImages[index % notificationImages.length]
                          }
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-base font-medium text-black dark:text-[#f0d34f]">
                              {meta.label}
                            </p>
                            <p className="mt-1 text-sm text-neutral-500 dark:text-[#cfbd78]">
                              {meta.description}
                            </p>
                          </div>
                          {relativeTime ? (
                            <span className="shrink-0 text-xs text-neutral-400 dark:text-[#8e7727]">
                              {relativeTime}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  );
                }))}
              </div>

              <button
                type="button"
                className="w-full px-5 py-4 text-center text-base font-semibold text-[#5647ff] transition hover:bg-neutral-50 dark:text-[#f0d34f] dark:hover:bg-[#11110f]"
                onClick={() => router.push("/user/account?section=notifications")}
              >
                {t("viewAllNotifications")}
              </button>
            </div>
          ) : null}

          {profileOpen ? (
            <div
              className="absolute right-0 top-14 z-30 w-[290px] overflow-hidden rounded-[22px] border border-neutral-200 bg-[#f8f8f8] p-3 shadow-[0_24px_60px_rgba(15,23,42,0.22)] dark:border-[#3a3112] dark:bg-[#090909] dark:text-[#f1d04b]"
              onMouseEnter={openProfilePreview}
              onMouseLeave={closeProfilePreview}
            >
              <div className="rounded-[18px] bg-white/90 p-4 dark:bg-[#11110f]">
                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-[#ebeff5] text-[#4b5563] dark:bg-[#171711] dark:text-[#f1d04b]">
                    {user.avatar ? (
                      <img src={user.avatar} alt={user.name ?? "Profile"} className="h-full w-full object-cover" />
                    ) : (
                      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-8 w-8" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M17 20C17 17.791 14.761 16 12 16C9.239 16 7 17.791 7 20" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                        <circle cx="12" cy="9" r="3.2" stroke="currentColor" strokeWidth="1.7" />
                      </svg>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-[#1f2937] dark:text-[#f1d04b]">{user.name}</p>
                    <p className="truncate text-sm text-neutral-500 dark:text-[#c7ba81]">{user.email}</p>
                  </div>
                </div>

                <div className="mt-4 space-y-1 border-t border-neutral-200 pt-3 dark:border-[#2c2817]">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left text-[15px] text-[#1f2937] transition hover:bg-neutral-100 dark:text-[#f1d04b] dark:hover:bg-[#171711]"
                    onClick={() => router.push("/user/account?section=profile")}
                  >
                    <span className="flex items-center gap-3">
                      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M17 20C17 17.791 14.761 16 12 16C9.239 16 7 17.791 7 20" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                        <circle cx="12" cy="9" r="3" stroke="currentColor" strokeWidth="1.7" />
                      </svg>
                      <span>{t("myProfile")}</span>
                    </span>
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 text-neutral-400 dark:text-[#8e7727]" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M9 6L15 12L9 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left text-[15px] text-[#1f2937] transition hover:bg-neutral-100 dark:text-[#f1d04b] dark:hover:bg-[#171711]"
                    onClick={() => router.push("/user/account?section=orders")}
                  >
                    <span className="flex items-center gap-3">
                      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M4 7.5H20" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                        <path d="M6.5 4.5H17.5V19.5H6.5V4.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                        <path d="M9 10.5H15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                        <path d="M9 14.5H13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                      </svg>
                      <span>{t("myOrders")}</span>
                    </span>
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 text-neutral-400 dark:text-[#8e7727]" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M9 6L15 12L9 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left text-[15px] text-[#1f2937] transition hover:bg-neutral-100 dark:text-[#f1d04b] dark:hover:bg-[#171711]"
                    onClick={openSettings}
                  >
                    <span className="flex items-center gap-3">
                      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 9.5A2.5 2.5 0 1 0 12 14.5A2.5 2.5 0 1 0 12 9.5Z" stroke="currentColor" strokeWidth="1.8" />
                        <path d="M19 12C19 11.523 18.94 11.061 18.826 10.621L20.5 9.25L18.75 6.25L16.72 7.02C16.05 6.47 15.275 6.045 14.426 5.783L14.1 3.75H9.9L9.574 5.783C8.725 6.045 7.95 6.47 7.28 7.02L5.25 6.25L3.5 9.25L5.174 10.621C5.06 11.061 5 11.523 5 12C5 12.477 5.06 12.939 5.174 13.379L3.5 14.75L5.25 17.75L7.28 16.98C7.95 17.53 8.725 17.955 9.574 18.217L9.9 20.25H14.1L14.426 18.217C15.275 17.955 16.05 17.53 16.72 16.98L18.75 17.75L20.5 14.75L18.826 13.379C18.94 12.939 19 12.477 19 12Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span>{t("settings")}</span>
                    </span>
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 text-neutral-400 dark:text-[#8e7727]" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M9 6L15 12L9 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-[15px] text-[#374151] transition hover:bg-neutral-100 dark:text-[#f1d04b] dark:hover:bg-[#171711]"
                    onClick={logout}
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M10 17L5 12L10 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M5 12H16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      <path d="M14 5H17C18.105 5 19 5.895 19 7V17C19 18.105 18.105 19 17 19H14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span>{t("logOut")}</span>
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {settingsOpen ? (
            <div className="absolute right-0 top-14 z-30 w-[300px] rounded-[18px] border border-neutral-200 bg-[#f6f6f6] p-4 shadow-[0_20px_50px_rgba(15,23,42,0.18)] dark:border-[#3a3112] dark:bg-[#11110f] dark:text-[#f1d04b]">
              <div className="flex items-center justify-between border-b border-neutral-200 pb-3 dark:border-[#2c2817]">
                <p className="text-lg font-semibold">{t("settings")}</p>
                <button
                  type="button"
                  aria-label="Close settings"
                  className="text-lg text-neutral-500 transition hover:text-black dark:text-[#c7ba81] dark:hover:text-[#f7db63]"
                  onClick={() => {
                    setSettingsOpen(false);
                    setLanguageMenuOpen(false);
                    setCurrencyMenuOpen(false);
                  }}
                >
                  x
                </button>
              </div>

              <div className="mt-4 space-y-4">
                <div className="relative">
                  <span className="mb-2 block text-sm text-neutral-500 dark:text-[#c7ba81]">{t("language")}</span>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-[18px] border border-neutral-300 bg-white px-4 py-3 text-sm text-[#111] transition dark:border-[#403710] dark:bg-[#0a0a09] dark:text-[#f1d04b]"
                    onClick={() => {
                      setLanguageMenuOpen((prev) => !prev);
                      setCurrencyMenuOpen(false);
                    }}
                  >
                    <span>{language}</span>
                    <svg aria-hidden="true" viewBox="0 0 12 12" className={`h-3 w-3 transition-transform ${languageMenuOpen ? "rotate-180" : ""}`} fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>

                  {languageMenuOpen ? (
                    <div className="mt-3 rounded-[24px] border border-neutral-300 bg-white p-3 shadow-[0_20px_50px_rgba(15,23,42,0.18)] dark:border-[#3a3112] dark:bg-[#090909]">
                      <div className="space-y-2">
                        {languageOptions.map((option) => (
                          <button
                            key={option}
                            type="button"
                            className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm transition ${
                              language === option
                                ? "bg-[#ecd04f] text-[#090909]"
                                : "text-[#111] hover:bg-neutral-100 dark:text-[#f1d04b] dark:hover:bg-[#11110f]"
                            }`}
                            onClick={() => handleLanguageChange(option)}
                          >
                            <span>{option}</span>
                            {language === option ? <span className="text-[11px] font-semibold uppercase tracking-[0.2em]">ON</span> : null}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="relative">
                  <span className="mb-2 block text-sm text-neutral-500 dark:text-[#c7ba81]">{t("currency")}</span>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-[18px] border border-neutral-300 bg-white px-4 py-3 text-sm text-[#111] transition dark:border-[#403710] dark:bg-[#0a0a09] dark:text-[#f1d04b]"
                    onClick={() => {
                      setCurrencyMenuOpen((prev) => !prev);
                      setLanguageMenuOpen(false);
                    }}
                  >
                    <span>{currencyOptions.find((option) => option.code === currency)?.label ?? currency}</span>
                    <svg aria-hidden="true" viewBox="0 0 12 12" className={`h-3 w-3 transition-transform ${currencyMenuOpen ? "rotate-180" : ""}`} fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>

                  {currencyMenuOpen ? (
                    <div className="mt-3 rounded-[24px] border border-neutral-300 bg-white p-3 shadow-[0_20px_50px_rgba(15,23,42,0.18)] dark:border-[#3a3112] dark:bg-[#090909]">
                      <div className="space-y-2">
                        {currencyOptions.map((option) => (
                          <button
                            key={option.code}
                            type="button"
                            className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm transition ${
                              currency === option.code
                                ? "bg-[#ecd04f] text-[#090909]"
                                : "text-[#111] hover:bg-neutral-100 dark:text-[#f1d04b] dark:hover:bg-[#11110f]"
                            }`}
                            onClick={() => handleCurrencyChange(option.code)}
                          >
                            <span>{option.label}</span>
                            {currency === option.code ? <span className="text-[11px] font-semibold uppercase tracking-[0.2em]">ON</span> : null}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
