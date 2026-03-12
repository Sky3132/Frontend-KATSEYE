"use client";

import { products, type Product } from "../../user/lib/products";

export const ADMIN_PRODUCTS_STORAGE_KEY = "katseye_admin_products";

export type ManagedProduct = Product;

const isManagedProduct = (value: unknown): value is ManagedProduct => {
  if (!value || typeof value !== "object") return false;

  const candidate = value as ManagedProduct;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.price === "number" &&
    typeof candidate.stock === "number" &&
    typeof candidate.status === "string" &&
    Array.isArray(candidate.gallery) &&
    Array.isArray(candidate.sizes)
  );
};

export const getDefaultManagedProducts = (): ManagedProduct[] =>
  products.map((product) => ({ ...product, gallery: [...product.gallery], details: [...product.details], sizes: [...product.sizes] }));

export const readManagedProducts = (): ManagedProduct[] => {
  if (typeof window === "undefined") return getDefaultManagedProducts();

  try {
    const raw = window.localStorage.getItem(ADMIN_PRODUCTS_STORAGE_KEY);
    if (!raw) return getDefaultManagedProducts();
    const parsed = JSON.parse(raw) as unknown[];
    const validItems = Array.isArray(parsed) ? parsed.filter(isManagedProduct) : [];
    return validItems.length > 0 ? validItems : getDefaultManagedProducts();
  } catch {
    return getDefaultManagedProducts();
  }
};

export const writeManagedProducts = (items: ManagedProduct[]) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ADMIN_PRODUCTS_STORAGE_KEY, JSON.stringify(items));
};

export const createManagedProductId = () => `admin-${Date.now()}`;
