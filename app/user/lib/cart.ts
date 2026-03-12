import { api, asNumber, asString, unwrapList, unwrapObject } from "../../lib/api";
import type { Product } from "./catalog-api";

export type CartItem = {
  id: string;
  productId: string;
  name: string;
  price: number;
  image: string;
  size: string;
  qty: number;
};

const CART_SELECTION_KEY = "katseye_cart_selection";
const NOTIFY_EVENT = "katseye:notify";
const CART_EVENT = "katseye:cart";
const EMPTY_CART: CartItem[] = [];
const EMPTY_SELECTION: string[] = [];
let cachedSelectionRaw: string | null = null;
let cachedSelectionSnapshot: string[] = EMPTY_SELECTION;
let cartSnapshot: CartItem[] = EMPTY_CART;
let cartRequest: Promise<CartItem[]> | null = null;
const listeners = new Set<() => void>();

const apiWith404Fallback = async <T>(
  paths: string[],
  options: RequestInit = {},
): Promise<T> => {
  let lastError: unknown = null;
  for (const path of paths) {
    try {
      return await api<T>(path, options);
    } catch (error) {
      lastError = error;
      if (error instanceof Error && error.message === "HTTP_404") {
        continue;
      }
      throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("HTTP_404");
};

const emitCart = () => {
  listeners.forEach((listener) => listener());
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CART_EVENT));
  }
};

const normalizeCartItem = (value: unknown): CartItem | null => {
  const record = unwrapObject(value);
  if (!record) return null;

  const product = unwrapObject(record.product);
  const productId = asString(record.product_id || product?.id);
  const id = asString(record.id);
  if (!id || !productId) return null;

  return {
    id,
    productId,
    name: asString(product?.title || product?.name, "KATSEYE Product"),
    price: asNumber(record.price, asNumber(product?.price)),
    image: asString(product?.image_url || product?.imgsrc || product?.imgSrc || product?.image, ""),
    size: asString(record.variant_name || record.size),
    qty: Math.max(1, asNumber(record.quantity, 1)),
  };
};

export const refreshCart = async (): Promise<CartItem[]> => {
  if (!cartRequest) {
    cartRequest = apiWith404Fallback(["/api/cart/items", "/api/cart"])
      .then((response) => unwrapList(response).map(normalizeCartItem).filter((item): item is CartItem => item !== null))
      .catch(() => EMPTY_CART)
      .then((items) => {
        cartSnapshot = items;
        writeSelectedCartItemIds(
          readSelectedCartItemIds().filter((id) => items.some((item) => item.id === id)),
        );
        emitCart();
        return items;
      })
      .finally(() => {
        cartRequest = null;
      });
  }

  return cartRequest;
};

export const readCart = (): CartItem[] => {
  return cartSnapshot;
};

export const readSelectedCartItemIds = (): string[] => {
  if (typeof window === "undefined") return EMPTY_SELECTION;

  try {
    const raw = window.localStorage.getItem(CART_SELECTION_KEY);
    if (raw === cachedSelectionRaw) return cachedSelectionSnapshot;
    if (!raw) {
      cachedSelectionRaw = null;
      cachedSelectionSnapshot = EMPTY_SELECTION;
      return cachedSelectionSnapshot;
    }
    const parsed = JSON.parse(raw) as string[];
    cachedSelectionRaw = raw;
    cachedSelectionSnapshot = Array.isArray(parsed) ? parsed : EMPTY_SELECTION;
    return cachedSelectionSnapshot;
  } catch {
    cachedSelectionRaw = null;
    cachedSelectionSnapshot = EMPTY_SELECTION;
    return cachedSelectionSnapshot;
  }
};

export const writeSelectedCartItemIds = (ids: string[]) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CART_SELECTION_KEY, JSON.stringify(ids));
  emitCart();
};

export const toggleSelectedCartItem = (id: string) => {
  const current = readSelectedCartItemIds();
  const next = current.includes(id)
    ? current.filter((itemId) => itemId !== id)
    : [...current, id];
  writeSelectedCartItemIds(next);
  return next;
};

export const selectOnlyCartItem = (id: string) => {
  writeSelectedCartItemIds([id]);
  return [id];
};

export const addToCart = async (product: Product, qty = 1): Promise<CartItem[]> => {
  await apiWith404Fallback(["/api/cart/items", "/api/cart"], {
    method: "POST",
    body: JSON.stringify({
      product_id: asNumber(product.backendId, asNumber(product.id)),
      quantity: qty,
    }),
  });

  return refreshCart();
};

export const removeFromCart = async (id: string): Promise<CartItem[]> => {
  await apiWith404Fallback([`/api/cart/items/${id}`, `/api/cart/${id}`], { method: "DELETE" });
  return refreshCart();
};

export const updateCartQty = async (id: string, qty: number): Promise<CartItem[]> => {
  if (qty <= 0) {
    return removeFromCart(id);
  }

  await apiWith404Fallback([`/api/cart/items/${id}`, `/api/cart/${id}`], {
    method: "PUT",
    body: JSON.stringify({ quantity: Math.max(1, qty) }),
  });
  return refreshCart();
};

export const getCartCount = (items: CartItem[]) => items.reduce((sum, item) => sum + item.qty, 0);
export const getCartSubtotal = (items: CartItem[]) =>
  items.reduce((sum, item) => sum + item.price * item.qty, 0);

export const subscribeCart = (callback: () => void) => {
  listeners.add(callback);
  void refreshCart();

  return () => {
    listeners.delete(callback);
  };
};

export const getCartServerSnapshot = (): CartItem[] => EMPTY_CART;
export const getSelectedCartServerSnapshot = (): string[] => EMPTY_SELECTION;

export const notifyStore = (
  payload:
    | string
    | {
        message: string;
        productId?: string;
        image?: string;
      },
) => {
  if (typeof window === "undefined") return;
  const detail = typeof payload === "string" ? { message: payload } : payload;
  window.dispatchEvent(new CustomEvent(NOTIFY_EVENT, { detail }));
};

export const getNotifyEventName = () => NOTIFY_EVENT;
