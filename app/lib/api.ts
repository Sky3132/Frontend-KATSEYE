"use client";

// Prefer setting this in `.env.local`:
// `NEXT_PUBLIC_API_BASE_URL=http://localhost:3001`
// All requests include cookies for httpOnly `auth_token`.
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:3001";

type JsonRecord = Record<string, unknown>;

const isJsonRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null;

export async function api<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  // We call endpoints with `/api/...` paths already; strip a trailing `/api` if the env var includes it.
  const baseUrl = API_BASE.replace(/\/+$/, "").replace(/\/api$/i, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const response = await fetch(`${baseUrl}${normalizedPath}`, {
    ...options,
    credentials: "include",
    cache: options.cache ?? "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  if (response.status === 401) throw new Error("UNAUTH");
  if (response.status === 403) throw new Error("FORBIDDEN");

  if (response.status === 204) return undefined as T;

  if (!response.ok) {
    throw new Error(`HTTP_${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return (await response.text()) as unknown as T;
  }
  return (await response.json().catch(() => null)) as T;
}

export const unwrapList = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  if (!isJsonRecord(value)) return [];

  const candidates = [value.data, value.items, value.results, value.products, value.orders];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  return [];
};

export const unwrapObject = (value: unknown): JsonRecord | null => {
  if (isJsonRecord(value)) return value;
  return null;
};

export const asNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

export const asString = (value: unknown, fallback = ""): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
};
