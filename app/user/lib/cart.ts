import type { Product } from "./products";

export type CartItem = {
  id: string;
  name: string;
  price: number;
  image: string;
  qty: number;
};

const CART_KEY = "katseye_cart";
const NOTIFY_EVENT = "katseye:notify";
const CART_EVENT = "katseye:cart";
const EMPTY_CART: CartItem[] = [];
let cachedCartRaw: string | null = null;
let cachedCartSnapshot: CartItem[] = EMPTY_CART;

export const readCart = (): CartItem[] => {
  if (typeof window === "undefined") return EMPTY_CART;
  try {
    const raw = window.localStorage.getItem(CART_KEY);
    if (raw === cachedCartRaw) return cachedCartSnapshot;
    if (!raw) {
      cachedCartRaw = null;
      cachedCartSnapshot = EMPTY_CART;
      return cachedCartSnapshot;
    }

    const parsed = JSON.parse(raw) as CartItem[];
    cachedCartRaw = raw;
    cachedCartSnapshot = Array.isArray(parsed) ? parsed : EMPTY_CART;
    return cachedCartSnapshot;
  } catch {
    cachedCartRaw = null;
    cachedCartSnapshot = EMPTY_CART;
    return cachedCartSnapshot;
  }
};

export const writeCart = (items: CartItem[]) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CART_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(CART_EVENT));
};

export const addToCart = (product: Product, qty = 1): CartItem[] => {
  const current = readCart();
  const existing = current.find((item) => item.id === product.id);

  if (existing) {
    existing.qty += qty;
    writeCart([...current]);
    return [...current];
  }

  const next = [
    ...current,
    {
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      qty,
    },
  ];
  writeCart(next);
  return next;
};

export const removeFromCart = (id: string): CartItem[] => {
  const next = readCart().filter((item) => item.id !== id);
  writeCart(next);
  return next;
};

export const updateCartQty = (id: string, qty: number): CartItem[] => {
  const next = readCart()
    .map((item) => (item.id === id ? { ...item, qty: Math.max(1, qty) } : item))
    .filter((item) => item.qty > 0);
  writeCart(next);
  return next;
};

export const getCartCount = (items: CartItem[]) => items.reduce((sum, item) => sum + item.qty, 0);
export const getCartSubtotal = (items: CartItem[]) =>
  items.reduce((sum, item) => sum + item.price * item.qty, 0);

export const subscribeCart = (callback: () => void) => {
  if (typeof window === "undefined") return () => {};

  const handleChange = () => callback();
  window.addEventListener("storage", handleChange);
  window.addEventListener(CART_EVENT, handleChange);

  return () => {
    window.removeEventListener("storage", handleChange);
    window.removeEventListener(CART_EVENT, handleChange);
  };
};

export const getCartServerSnapshot = (): CartItem[] => EMPTY_CART;

export const notifyStore = (message: string) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(NOTIFY_EVENT, { detail: { message } }));
};

export const getNotifyEventName = () => NOTIFY_EVENT;
