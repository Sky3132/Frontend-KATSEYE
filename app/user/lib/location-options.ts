"use client";

import { api, asString, unwrapList, unwrapObject } from "../../lib/api";

// ─── Types ───────────────────────────────────────────────────────────────────

export type LocationItem = {
  id: string;
  name: string;
  type: string;
  has_children?: boolean;
};

export type LocationCountry = LocationItem & {
  country_code: string;
};

export type LocationSchemaLevel = {
  type: "region" | "province" | "city" | "district";
  label: string;
  required: boolean;
};

export type LocationSchema = {
  country_code: string;
  levels: LocationSchemaLevel[];
};

// ─── Normalisers ─────────────────────────────────────────────────────────────

function normalizeItem(raw: unknown): LocationItem | null {
  const r = unwrapObject(raw);
  if (!r) return null;
  const id = asString(r.id);
  const name = asString(r.name);
  if (!id || !name) return null;
  return {
    id,
    name,
    type: asString(r.type),
    has_children: Boolean(r.has_children),
  };
}

function normalizeCountry(raw: unknown): LocationCountry | null {
  const item = normalizeItem(raw);
  if (!item) return null;
  const r = unwrapObject(raw)!;
  const country_code = asString(r.country_code || r.countryCode);
  if (!country_code) return null;
  // Important: frontend treats `id` as the country selector value and as the
  // parent_id for `/locations/children`. Backend seed uses ISO code as place id.
  // Normalize to ISO to avoid "no regions" / phone-code mismatches.
  return { ...item, id: country_code, country_code };
}

// ─── API calls ────────────────────────────────────────────────────────────────

/**
 * Fetch the list of all countries from the backend.
 * Returns items sorted by the backend (sort_order then name).
 */
export async function fetchCountries(): Promise<LocationCountry[]> {
  try {
    const response = await api("/api/locations/countries");
    const record = unwrapObject(response);
    const items = unwrapList(record?.items ?? response);
    return items
      .map(normalizeCountry)
      .filter((c): c is LocationCountry => c !== null);
  } catch {
    return [];
  }
}

/**
 * Fetch the address schema (which levels are required) for a country.
 */
export async function fetchLocationSchema(
  countryCode: string,
): Promise<LocationSchema | null> {
  if (!countryCode) return null;
  try {
    const response = await api(
      `/api/locations/schema?country_code=${encodeURIComponent(countryCode)}`,
    );
    const record = unwrapObject(response);
    if (!record) return null;
    const levels = unwrapList(record.levels)
      .map((raw) => {
        const r = unwrapObject(raw);
        if (!r) return null;
        return {
          type: asString(r.type) as LocationSchemaLevel["type"],
          label: asString(r.label),
          required: Boolean(r.required),
        };
      })
      .filter(
        (l): l is LocationSchemaLevel => l !== null && !!l.type && !!l.label,
      );
    return {
      country_code: asString(record.country_code || record.countryCode),
      levels,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch the direct children of a place (e.g. regions of a country, provinces of a region).
 */
export async function fetchLocationChildren(
  parentId: string,
  type: "region" | "province" | "city" | "district",
): Promise<LocationItem[]> {
  if (!parentId || !type) return [];
  try {
    const url = `/api/locations/children?parent_id=${encodeURIComponent(parentId)}&type=${encodeURIComponent(type)}`;
    const response = await api(url);
    const record = unwrapObject(response);
    const items = unwrapList(record?.items ?? response);
    return items
      .map(normalizeItem)
      .filter((i): i is LocationItem => i !== null);
  } catch {
    return [];
  }
}

/**
 * Search places by name within a country.
 */
export async function searchLocations(
  countryCode: string,
  type: "region" | "province" | "city" | "district",
  q: string,
): Promise<LocationItem[]> {
  if (!countryCode || !type || !q.trim()) return [];
  try {
    const url = `/api/locations/search?country_code=${encodeURIComponent(countryCode)}&type=${encodeURIComponent(type)}&q=${encodeURIComponent(q.trim())}`;
    const response = await api(url);
    const record = unwrapObject(response);
    const items = unwrapList(record?.items ?? response);
    return items
      .map(normalizeItem)
      .filter((i): i is LocationItem => i !== null);
  } catch {
    return [];
  }
}
