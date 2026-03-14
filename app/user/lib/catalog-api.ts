"use client";

import { api, asNumber, asString, unwrapList, unwrapObject } from "../../lib/api";
import { slugifyCategoryName } from "./categories-api";

export type ProductStatus = "available" | "pre-order" | "sold-out";

export type Product = {
  id: string;
  backendId: string;
  name: string;
  brand: string;
  price: number;
  stock: number;
  inStock: boolean;
  status: ProductStatus;
  category: "album" | "cloth" | "accessories";
  categoryId: string;
  categoryName: string;
  mainCategoryId: string;
  mainCategoryName: string;
  subcategoryId: string;
  subcategoryName: string;
  parentCategoryId: string;
  subcategory: string;
  image: string;
  gallery: string[];
  description: string;
  details: string[];
  sizes: string[];
};

const defaultImage = "https://shop.katseye.world/cdn/shop/files/gnarly-shirt-front.png?v=1745875951&width=1000";

const getCategory = (value: unknown): Product["category"] => {
  const normalized = asString(value).toLowerCase();
  if (normalized.includes("album") || normalized.includes("music") || normalized.includes("cd") || normalized.includes("vinyl")) {
    return "album";
  }
  if (normalized.includes("access")) return "accessories";
  return "cloth";
};

const getSubcategory = (value: unknown, fallbackCategory: Product["category"]) => {
  const normalized = asString(value).trim().toLowerCase();
  if (normalized) return normalized;
  if (fallbackCategory === "album") return "albums";
  if (fallbackCategory === "accessories") return "accessories";
  return "apparel";
};

const getStatus = (stock: number): ProductStatus => (stock > 0 ? "available" : "sold-out");

const getFirstFiniteNumber = (values: unknown[]) => {
  for (const value of values) {
    const parsed = asNumber(value, Number.NaN);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const normalizeStock = (record: Record<string, unknown>) => {
  const direct = getFirstFiniteNumber([
    record.stock,
    record.quantity,
    record.inventory,
    record.inventory_quantity,
    record.inventoryQuantity,
    record.inventory_count,
    record.available_stock,
    record.availableStock,
  ]);

  if (direct !== null && direct > 0) return direct;

  if (Array.isArray(record.variants)) {
    const variantNumbers = record.variants
      .map((variant) => unwrapObject(variant))
      .filter((variant): variant is Record<string, unknown> => variant !== null)
      .map((variant) =>
        getFirstFiniteNumber([
          variant.stock,
          variant.quantity,
          variant.inventory,
          variant.inventory_quantity,
          variant.inventoryQuantity,
        ]),
      )
      .filter((value): value is number => value !== null);

    if (variantNumbers.length > 0) {
      return variantNumbers.reduce((sum, value) => sum + value, 0);
    }
  }

  return direct ?? 0;
};

const normalizeVariantNames = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => unwrapObject(item))
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((item) => asString(item.name || item.title))
    .filter(Boolean);
};

const normalizeImages = (record: Record<string, unknown>) => {
  const candidates = [
    record.image_url,
    record.imgsrc,
    record.imgSrc,
    record.image,
    record.thumbnail,
    record.photo,
    record.cover_image,
  ]
    .map((item) => asString(item))
    .filter(Boolean);

  const gallery = Array.isArray(record.images)
    ? record.images.map((item) => asString(item)).filter(Boolean)
    : Array.isArray(record.gallery)
      ? record.gallery.map((item) => asString(item)).filter(Boolean)
      : [];

  const merged = [...candidates, ...gallery];
  return merged.length > 0 ? Array.from(new Set(merged)) : [defaultImage];
};

const normalizeProduct = (value: unknown): Product | null => {
  const record = unwrapObject(value);
  if (!record) return null;

  const backendId = asString(record.id || record.product_id);
  if (!backendId) return null;

  const stock = Math.max(0, normalizeStock(record));
  const inStockRaw = record.in_stock ?? record.inStock ?? record.available ?? record.is_available ?? record.isAvailable;
  const inStock =
    typeof inStockRaw === "boolean"
      ? inStockRaw
      : typeof inStockRaw === "number"
        ? inStockRaw > 0
        : stock > 0;
  const mainCategoryId = asString(record.main_category_id || record.mainCategoryId || "");
  const mainCategoryName = asString(record.main_category_name || record.mainCategoryName || "");
  const subcategoryId = asString(
    record.subcategory_id || record.subcategoryId || record.category_id || record.categoryId || "",
  );
  const subcategoryName = asString(
    record.subcategory_name || record.subcategoryName || record.category_name || record.categoryName || record.category || "",
  );
  const categoryId = subcategoryId || mainCategoryId;
  const categoryName = subcategoryName || mainCategoryName;
  const parentCategoryId = asString(
    record.parent_category_id || record.parentCategoryId || "",
  );
  const category = getCategory(
    mainCategoryName ||
      record.category ||
      record.category_name ||
      record.category_slug ||
      record.type ||
      categoryName,
  );
  const images = normalizeImages(record);
  const sizes = normalizeVariantNames(record.variants);
  const subcategory = subcategoryName
    ? slugifyCategoryName(subcategoryName)
    : parentCategoryId && categoryName
      ? slugifyCategoryName(categoryName)
      : getSubcategory(record.subcategory || record.slug, category);

  return {
    id: backendId,
    backendId,
    name: asString(record.title || record.name, "Untitled Product"),
    brand: asString(record.brand, "KATSEYE"),
    price: asNumber(record.price),
    stock,
    inStock,
    status: getStatus(stock),
    category,
    categoryId,
    categoryName,
    mainCategoryId,
    mainCategoryName,
    subcategoryId,
    subcategoryName: subcategoryName || "",
    parentCategoryId,
    subcategory,
    image: images[0] ?? defaultImage,
    gallery: images,
    description: asString(record.description, "No description available."),
    details: Array.isArray(record.details)
      ? record.details.map((item) => asString(item)).filter(Boolean)
      : [],
    sizes: sizes.length > 0 ? sizes : ["Default"],
  };
};

export async function fetchProducts(): Promise<Product[]> {
  const response = await api("/api/products");
  return unwrapList(response).map(normalizeProduct).filter((item): item is Product => item !== null);
}

export async function fetchProductById(id: string): Promise<Product | null> {
  const response = await api(`/api/products/${id}`);
  return normalizeProduct(response);
}

export async function fetchAdminProducts(): Promise<Product[]> {
  const response = await api("/api/admin/products");
  return unwrapList(response).map(normalizeProduct).filter((item): item is Product => item !== null);
}

export async function fetchAdminArchivedProducts(): Promise<Product[]> {
  const response = await api("/api/admin/products/archived");
  return unwrapList(response)
    .map(normalizeProduct)
    .filter((item): item is Product => item !== null);
}
