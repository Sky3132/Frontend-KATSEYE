"use client";

import { API_BASE } from "../../lib/api";

export type FxQuote = "USD" | "PHP" | "JPY" | "KRW";

const FX_CACHE_KEY = "katseye-fx-cache:USD";

type FxCacheRecord = {
  rates: Partial<Record<FxQuote, number>>;
  updatedAt: number;
};

const readCache = (): FxCacheRecord => {
  if (typeof window === "undefined") return { rates: {}, updatedAt: 0 };
  try {
    const raw = window.sessionStorage.getItem(FX_CACHE_KEY);
    if (!raw) return { rates: {}, updatedAt: 0 };
    const parsed = JSON.parse(raw) as FxCacheRecord;
    if (!parsed || typeof parsed !== "object") return { rates: {}, updatedAt: 0 };
    return {
      rates: typeof parsed.rates === "object" && parsed.rates ? parsed.rates : {},
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : 0,
    };
  } catch {
    return { rates: {}, updatedAt: 0 };
  }
};

const writeCache = (next: FxCacheRecord) => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(FX_CACHE_KEY, JSON.stringify(next));
  } catch {
    // ignore quota / private mode
  }
};

const normalizeRate = (value: unknown): number | null => {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
};

export async function fetchUsdFxRate(quote: FxQuote, signal?: AbortSignal): Promise<number> {
  if (quote === "USD") return 1;

  const cached = readCache();
  const cachedRate = cached.rates[quote];
  if (cachedRate && Number.isFinite(cachedRate) && cachedRate > 0) return cachedRate;

  // API server uses a global `/api` prefix; normalize API_BASE to not end with `/api`.
  const baseUrl = API_BASE.replace(/\/+$/, "").replace(/\/api$/i, "");
  const res = await fetch(
    `${baseUrl}/api/fx?base=USD&quote=${encodeURIComponent(quote)}`,
    { credentials: "include", cache: "no-store", signal },
  );

  if (!res.ok) {
    const message = (await res.text().catch(() => "")).trim();
    throw new Error(message || `HTTP_${res.status}`);
  }

  const payload = (await res.json().catch(() => null)) as unknown;
  const record = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
  const rate =
    normalizeRate(record?.rate) ??
    normalizeRate(record?.fx_rate) ??
    normalizeRate(record?.fxRate) ??
    normalizeRate(record?.value);

  if (rate == null) throw new Error("Invalid FX response.");

  writeCache({
    rates: { ...cached.rates, [quote]: rate },
    updatedAt: Date.now(),
  });

  return rate;
}
