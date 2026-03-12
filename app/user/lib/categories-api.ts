"use client";

import { api, asString, unwrapObject } from "../../lib/api";

export type CategoryNode = {
  id: string;
  name: string;
  slug: string;
  children: CategoryNode[];
};

export const slugifyCategoryName = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

const normalizeCategoryNode = (value: unknown): CategoryNode | null => {
  const record = unwrapObject(value);
  if (!record) return null;

  const id = asString(record.id);
  const name = asString(record.category_name ?? record.categoryName ?? record.name);
  if (!id || !name) return null;

  const children = Array.isArray(record.children)
    ? record.children
        .map(normalizeCategoryNode)
        .filter((item): item is CategoryNode => item !== null)
    : [];

  return { id, name, slug: slugifyCategoryName(name), children };
};

export const normalizeCategoriesTree = (value: unknown): CategoryNode[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map(normalizeCategoryNode)
    .filter((item): item is CategoryNode => item !== null);
};

export async function fetchCategoriesTree(): Promise<CategoryNode[]> {
  const response = await api("/api/categories/tree");
  return normalizeCategoriesTree(response);
}

