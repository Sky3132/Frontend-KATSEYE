"use client";

import { fetchProducts } from "./catalog-api";
import { fetchOrders } from "./orders-api";

type NotificationItem = {
  id: string;
  message: string;
  createdAt: string;
  read: boolean;
  image?: string;
  productId?: string;
};

const NOTIFICATIONS_KEY = "katseye_notifications";
const NOTIFICATIONS_EVENT = "katseye:notifications";

const PRODUCTS_SNAPSHOT_KEY = "katseye_snapshot_products";
const ORDERS_SNAPSHOT_KEY = "katseye_snapshot_orders";

type ProductSnapshot = {
  ids: string[];
  stock: Record<string, number>;
};

type OrderSnapshot = Record<string, string>;

const readJson = <T,>(key: string, fallback: T): T => {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const writeJson = (key: string, value: unknown) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
};

const readNotifications = (): NotificationItem[] => {
  return readJson<NotificationItem[]>(NOTIFICATIONS_KEY, []);
};

const writeNotifications = (
  updater: NotificationItem[] | ((current: NotificationItem[]) => NotificationItem[]),
) => {
  if (typeof window === "undefined") return;
  const current = readNotifications();
  const next = typeof updater === "function" ? updater(current) : updater;
  window.localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(NOTIFICATIONS_EVENT));
};

const pushNotifications = (items: Array<Pick<NotificationItem, "message" | "image" | "productId">>) => {
  if (items.length === 0) return;
  const now = new Date();
  writeNotifications((current) => [
    ...items.map(({ message, image, productId }) => ({
      id: crypto.randomUUID(),
      message,
      createdAt: now.toISOString(),
      read: false,
      image,
      productId,
    })),
    ...current,
  ]);
};

const buildProductSnapshot = (products: Awaited<ReturnType<typeof fetchProducts>>): ProductSnapshot => {
  const ids: string[] = [];
  const stock: Record<string, number> = {};

  for (const product of products) {
    ids.push(product.id);
    stock[product.id] = product.stock;
  }

  return { ids, stock };
};

const buildOrderSnapshot = (orders: Awaited<ReturnType<typeof fetchOrders>>): OrderSnapshot => {
  const snapshot: OrderSnapshot = {};
  for (const order of orders) {
    const key = order.rawStatus || order.shipmentStatus || order.status;
    snapshot[order.id] = String(key ?? "");
  }
  return snapshot;
};

export async function syncUserNotifications(): Promise<number> {
  if (typeof window === "undefined") return 0;

  const [products, orders] = await Promise.all([fetchProducts(), fetchOrders()]);

  const previousProducts = readJson<ProductSnapshot>(PRODUCTS_SNAPSHOT_KEY, { ids: [], stock: {} });
  const previousOrders = readJson<OrderSnapshot>(ORDERS_SNAPSHOT_KEY, {});

  const nextProducts = buildProductSnapshot(products);
  const nextOrders = buildOrderSnapshot(orders);

  const notifications: Array<Pick<NotificationItem, "message" | "image" | "productId">> = [];

  // New products.
  const previousIdSet = new Set(previousProducts.ids);
  const newProducts = products.filter((product) => !previousIdSet.has(product.id)).slice(0, 3);
  for (const product of newProducts) {
    notifications.push({
      message: `New product added: ${product.name}`,
      image: product.image,
      productId: product.id,
    });
  }

  // Stock changes.
  for (const product of products) {
    const prev = previousProducts.stock[product.id];
    if (typeof prev !== "number") continue;
    if (prev === product.stock) continue;

    if (prev <= 0 && product.stock > 0) {
      notifications.push({
        message: `Restocked: ${product.name} (${product.stock} available)`,
        image: product.image,
        productId: product.id,
      });
      continue;
    }

    if (product.stock <= 0) {
      notifications.push({
        message: `Out of stock: ${product.name}`,
        image: product.image,
        productId: product.id,
      });
      continue;
    }

    if (product.stock <= 5) {
      notifications.push({
        message: `Low stock: ${product.name} (${product.stock} left)`,
        image: product.image,
        productId: product.id,
      });
    }
  }

  // Order status changes.
  for (const order of orders) {
    const previous = previousOrders[order.id];
    const current = nextOrders[order.id];
    if (!previous || !current || previous === current) continue;
    notifications.push({
      message: `Order #${order.id} updated: ${current}`,
      image: order.image,
    });
  }

  pushNotifications(notifications);

  writeJson(PRODUCTS_SNAPSHOT_KEY, nextProducts);
  writeJson(ORDERS_SNAPSHOT_KEY, nextOrders);

  return notifications.length;
}
