"use client";

import { useEffect, useRef, useState } from "react";
import { notifyStore } from "./cart";
import { fetchProducts, type Product } from "./catalog-api";

type UseLiveProductsOptions = {
  intervalMs?: number;
  deps?: unknown[];
  filter?: (product: Product) => boolean;
  notifyOnNew?: boolean;
};

const defaultOptions: Required<Pick<UseLiveProductsOptions, "intervalMs" | "notifyOnNew">> = {
  intervalMs: 15000,
  notifyOnNew: true,
};

const PRODUCTS_REFRESH_EVENT = "katseye:products:refresh";

export const requestProductsRefresh = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PRODUCTS_REFRESH_EVENT));
};

export function useLiveProducts(options: UseLiveProductsOptions = {}) {
  const intervalMs = options.intervalMs ?? defaultOptions.intervalMs;
  const notifyOnNew = options.notifyOnNew ?? defaultOptions.notifyOnNew;
  const filter = options.filter;
  const deps = options.deps ?? [];

  const [products, setProducts] = useState<Product[]>([]);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const isFirstLoadRef = useRef(true);

  useEffect(() => {
    let active = true;
    knownIdsRef.current = new Set();
    isFirstLoadRef.current = true;

    const apply = (items: Product[]) => {
      const next = filter ? items.filter(filter) : items;
      const nextIds = new Set(next.map((item) => item.id));

      let newCount = 0;
      for (const id of nextIds) {
        if (!knownIdsRef.current.has(id)) {
          newCount += 1;
        }
      }

      knownIdsRef.current = nextIds;
      if (active) setProducts(next);

      if (notifyOnNew && !isFirstLoadRef.current && newCount > 0) {
        notifyStore(`${newCount} new product${newCount === 1 ? "" : "s"} just dropped.`);
      }

      isFirstLoadRef.current = false;
    };

    const refresh = async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const items = await fetchProducts();
        if (!active) return;
        apply(items);
      } catch {
        if (active && isFirstLoadRef.current) setProducts([]);
      }
    };

    void refresh();

    const timer = window.setInterval(refresh, intervalMs);
    const handleVisibility = () => void refresh();
    const handleManualRefresh = () => void refresh();
    window.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener(PRODUCTS_REFRESH_EVENT, handleManualRefresh);

    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener(PRODUCTS_REFRESH_EVENT, handleManualRefresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, notifyOnNew, filter, ...deps]);

  return products;
}
