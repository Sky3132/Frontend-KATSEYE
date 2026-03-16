"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, asNumber, asString, unwrapList, unwrapObject } from "../lib/api";

type StockItem = {
  id: string;
  name: string;
  sku: string;
  stock: number;
  status: "In Stock" | "Low Stock" | "Out of Stock";
};

type OrderStatus = "paid" | "pending" | "shipped" | "delivered";
type RecentOrder = {
  id: string;
  orderNumber: string;
  userEmail: string;
  userName: string;
  itemTitles: string[];
  totalAmount: number;
  status: OrderStatus;
  orderDate: string;
};

type MostSoldProductItem = {
  rank: number;
  key: string;
  name: string;
  quantitySold: number;
  revenue: number;
  avgUnitPrice: number | null;
};

type StockFeedStatus = "in_stock" | "low_stock" | "out_of_stock";
type StockFeedItem = {
  product_id: string | number;
  title: string;
  sku?: string | null;
  stock_qty: number;
  status: StockFeedStatus;
  variant_id?: string | number | null;
  variant_name?: string | null;
};

type StockFeedResponse = {
  lowThreshold: number;
  items: StockFeedItem[];
};

const mapStockStatus = (status: StockFeedStatus): StockItem["status"] => {
  if (status === "in_stock") return "In Stock";
  if (status === "low_stock") return "Low Stock";
  return "Out of Stock";
};

const EMPTY_MONTHLY_SERIES = Array.from({ length: 12 }, () => 0);

const normalizeMonthlySeries = (value: unknown): number[] => {
  if (!Array.isArray(value)) return EMPTY_MONTHLY_SERIES;
  const series = value
    .slice(0, 12)
    .map((item) => Math.max(0, asNumber(item, 0)));
  while (series.length < 12) series.push(0);
  return series;
};

const extractMonthlySales = (value: unknown): number[] | null => {
  const record = unwrapObject(value);
  if (!record) return null;

  const direct = record.monthlySales ?? record.monthly_sales ?? record.sales_by_month ?? record.salesByMonth;
  const directSeries = normalizeMonthlySeries(direct);
  if (directSeries.some((item) => item > 0)) return directSeries;

  const data = unwrapObject(record.data);
  if (data) {
    const nested = data.monthlySales ?? data.monthly_sales ?? data.sales_by_month ?? data.salesByMonth;
    const nestedSeries = normalizeMonthlySeries(nested);
    if (nestedSeries.some((item) => item > 0)) return nestedSeries;
  }

  return null;
};

function statusPill(status: StockItem["status"] | OrderStatus) {
  if (status === "In Stock" || status === "paid" || status === "delivered") {
    return "bg-emerald-100 text-emerald-700";
  }
  if (status === "Low Stock" || status === "pending") return "bg-amber-100 text-amber-700";
  if (status === "shipped") return "bg-blue-100 text-blue-700";
  return "bg-rose-100 text-rose-700";
}

const normalizeStockFeedResponse = (value: unknown): StockFeedResponse => {
  const record = unwrapObject(value);
  if (!record) return { lowThreshold: 5, items: [] };

  const lowThreshold = asNumber(record.lowThreshold, 5);
  const rawItems = Array.isArray(record.items) ? record.items : [];
  const items = rawItems
    .map((item) => unwrapObject(item))
    .filter((item): item is Record<string, unknown> => item !== null)
    .map(
      (item): StockFeedItem => ({
        product_id: asString(item.product_id),
        title: asString(item.title),
        sku: item.sku ? asString(item.sku) : null,
        stock_qty: asNumber(item.stock_qty),
        status: (asString(item.status) as StockFeedStatus) || "out_of_stock",
        variant_id: item.variant_id ? asString(item.variant_id) : null,
        variant_name: item.variant_name ? asString(item.variant_name) : null,
      }),
    )
    .filter((item) => Boolean(item.title));

  return { lowThreshold, items };
};

const extractDashboardTotalStock = (value: unknown): number | null => {
  const record = unwrapObject(value);
  if (!record) return null;

  const candidates = [
    record.totalStock,
    record.total_stock,
    record.stockTotal,
    record.stock_total,
    record.currentStocks,
    record.current_stocks,
    record.currentStock,
    record.current_stock,
  ];

  for (const candidate of candidates) {
    const parsed = asNumber(candidate, Number.NaN);
    if (Number.isFinite(parsed)) return parsed;
  }

  return null;
};

const normalizeOrderStatus = (value: unknown): OrderStatus => {
  const lowered = asString(value).toLowerCase();
  if (lowered === "paid") return "paid";
  if (lowered === "shipped") return "shipped";
  if (lowered === "delivered") return "delivered";
  return "pending";
};

const extractRecentOrderItemTitles = (record: Record<string, unknown>) => {
  const candidates =
    record.items ??
    record.order_items ??
    record.orderItems ??
    record.products ??
    record.line_items ??
    record.lineItems;
  const raw = Array.isArray(candidates) ? candidates : [];
  const titles = raw
    .map((item) => unwrapObject(item))
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((item) => {
      const product = unwrapObject(item.product) ?? unwrapObject(item.item);
      const title = asString(
        item.title ??
          item.name ??
          item.product_title ??
          item.productTitle ??
          product?.title ??
          product?.name ??
          "",
      );
      const variant = asString(item.variant_name ?? item.variantName ?? "");
      const quantity = asNumber(item.quantity ?? item.qty ?? item.count, Number.NaN);
      if (!title) return "";
      const suffix = variant ? ` (${variant})` : "";
      const qty = Number.isFinite(quantity) && quantity > 1 ? ` x${Math.floor(quantity)}` : "";
      return `${title}${suffix}${qty}`;
    })
    .filter(Boolean);

  return Array.from(new Set(titles)).slice(0, 3);
};

const normalizeRecentOrders = (value: unknown): RecentOrder[] => {
  const record = unwrapObject(value);
  if (!record) return [];

  const rawOrders = Array.isArray(record.recentOrders)
    ? record.recentOrders
    : Array.isArray(record.recent_orders)
      ? record.recent_orders
      : [];

  return rawOrders
    .map((item) => unwrapObject(item))
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((item, index): RecentOrder => {
      const idCandidate =
        item.id ?? item.order_id ?? item.orderId ?? item.orderID ?? item.order_number;
      const id = asString(idCandidate || index);
      return {
        id,
        orderNumber: asString(item.order_number ?? item.orderNumber ?? ""),
        userEmail: asString(item.user_email ?? item.userEmail ?? ""),
        userName: asString(item.user_name ?? item.userName ?? ""),
        itemTitles: extractRecentOrderItemTitles(item),
        totalAmount: asNumber(item.total_amount ?? item.totalAmount),
        status: normalizeOrderStatus(item.status),
        orderDate: asString(item.order_date ?? item.orderDate ?? ""),
      };
    })
    .filter((item) => Boolean(item.id));
};

const getCurrencyFormatter = () =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

type MostSoldResponse = {
  bestSeller: MostSoldProductItem | null;
  items: MostSoldProductItem[];
};

type DashboardKpis = {
  totalSalesValue: number | null;
  totalSalesChangePercent: number | null;
  ordersValue: number | null;
  paidOrdersValue: number | null;
  reportsGeneratedValue: number | null;
};

const normalizeMostSoldResponse = (value: unknown): MostSoldResponse => {
  const record = unwrapObject(value);
  if (!record) return { bestSeller: null, items: [] };

  const rawItems = Array.isArray(record.items)
    ? record.items
    : Array.isArray(record.data)
      ? record.data
      : unwrapList(value);

  const items = rawItems
    .map((item) => unwrapObject(item))
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((item, index): MostSoldProductItem => {
      const product = unwrapObject(item.product);
      const name = asString(
        item.title ??
          item.name ??
          item.product_title ??
          item.productTitle ??
          product?.title ??
          product?.name,
        "Unknown item",
      );
      const productId = asString(
        item.product_id ??
          item.productId ??
          item.productID ??
          product?.id ??
          product?.product_id,
        "",
      );
      const key = productId || `${name.toLowerCase()}-${index}`;

      const rank = Math.max(1, Math.floor(asNumber(item.rank, index + 1)));
      const quantitySold = Math.max(
        0,
        Math.floor(
          asNumber(
            item.quantity_sold ?? item.quantitySold ?? item.qty_sold ?? item.qtySold,
          ),
        ),
      );
      const revenue = Math.max(0, asNumber(item.revenue));
      const avgUnitPriceRaw = asNumber(
        item.avg_unit_price ?? item.avgUnitPrice,
        Number.NaN,
      );

      return {
        rank,
        key,
        name,
        quantitySold,
        revenue,
        avgUnitPrice: Number.isFinite(avgUnitPriceRaw) ? avgUnitPriceRaw : null,
      };
    })
    .filter((item) => Boolean(item.name));

  const bestSellerRecord = unwrapObject(record.best_seller ?? record.bestSeller);
  const bestSeller = bestSellerRecord
    ? normalizeMostSoldResponse({ items: [bestSellerRecord] }).items[0] ?? null
    : items.find((item) => item.rank === 1) ?? null;

  return {
    bestSeller,
    items: items.sort((a, b) => a.rank - b.rank).filter((item) => item.rank > 0),
  };
};

const normalizeDashboardKpis = (value: unknown): DashboardKpis => {
  const record = unwrapObject(value);
  if (!record) {
    return {
      totalSalesValue: null,
      totalSalesChangePercent: null,
      ordersValue: null,
      paidOrdersValue: null,
      reportsGeneratedValue: null,
    };
  }

  const cards = unwrapObject(record.cards);
  const totalSales = cards ? unwrapObject(cards.total_sales) : null;
  const orders = cards ? unwrapObject(cards.orders) : null;
  const reportsGenerated = cards ? unwrapObject(cards.reports_generated) : null;

  const totalSalesValue = totalSales ? asNumber(totalSales.value, Number.NaN) : Number.NaN;
  const totalSalesChangePercent = totalSales
    ? asNumber(totalSales.change_percent, Number.NaN)
    : Number.NaN;

  const ordersValue = orders ? asNumber(orders.value, Number.NaN) : Number.NaN;
  const paidOrdersValue = orders ? asNumber(orders.paid_orders, Number.NaN) : Number.NaN;
  const reportsGeneratedValue = reportsGenerated
    ? asNumber(reportsGenerated.value, Number.NaN)
    : Number.NaN;

  return {
    totalSalesValue: Number.isFinite(totalSalesValue) ? totalSalesValue : null,
    totalSalesChangePercent: Number.isFinite(totalSalesChangePercent)
      ? totalSalesChangePercent
      : null,
    ordersValue: Number.isFinite(ordersValue) ? ordersValue : null,
    paidOrdersValue: Number.isFinite(paidOrdersValue) ? paidOrdersValue : null,
    reportsGeneratedValue: Number.isFinite(reportsGeneratedValue)
      ? reportsGeneratedValue
      : null,
  };
};

export default function AdminDashboard() {
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [stockLowThreshold] = useState(5);
  const [dashboardTotalStock, setDashboardTotalStock] = useState<number | null>(null);
  const [stockLoading, setStockLoading] = useState(true);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [recentOrdersLoading, setRecentOrdersLoading] = useState(true);
  const [lastSaved, setLastSaved] = useState("Not saved yet");
  const [mostSoldItems, setMostSoldItems] = useState<MostSoldProductItem[]>([]);
  const [bestSeller, setBestSeller] = useState<MostSoldProductItem | null>(null);
  const [mostSoldLoading, setMostSoldLoading] = useState(true);
  const [kpis, setKpis] = useState<DashboardKpis>(() =>
    normalizeDashboardKpis(null),
  );
  const [kpisLoading, setKpisLoading] = useState(true);
  const [monthlySales, setMonthlySales] = useState<number[]>(EMPTY_MONTHLY_SERIES);
  const [monthlySalesLoading, setMonthlySalesLoading] = useState(true);
  const [monthlySalesUpdatedAt, setMonthlySalesUpdatedAt] = useState<string>("");

  const refreshStocks = useCallback(async () => {
    setStockLoading(true);
    try {
      const [nextStocks, totalFromDashboard] = await Promise.all([
        api(`/api/admin/dashboard/stocks?lowThreshold=${stockLowThreshold}`)
          .then((response) => {
            const normalized = normalizeStockFeedResponse(response);
            return normalized.items.map((item, index): StockItem => {
              const sku = item.sku ?? item.variant_name ?? "";
              const idSuffix = item.variant_id ?? (sku || String(index));
              const id = `${item.product_id}-${idSuffix}`;
              return {
                id,
                name: item.title,
                sku,
                stock: item.stock_qty,
                status: mapStockStatus(item.status),
              };
            });
          })
          .catch(() => [] as StockItem[]),
        api("/api/admin/dashboard").then(extractDashboardTotalStock).catch(() => null),
      ]);

      setStocks(nextStocks);
      setDashboardTotalStock(totalFromDashboard);
    } finally {
      setStockLoading(false);
    }
  }, [stockLowThreshold]);

  useEffect(() => {
    let active = true;
    void refreshStocks().catch(() => {
      if (!active) return;
    });
    return () => {
      active = false;
    };
  }, [refreshStocks]);

  useEffect(() => {
    let cancelled = false;

    api("/api/admin/dashboard/summary")
      .then((response) => normalizeRecentOrders(response))
      .then((items) => {
        if (cancelled) return;
        setRecentOrders(items);
      })
      .catch(() => {
        if (cancelled) return;
        setRecentOrders([]);
      })
      .finally(() => {
        if (cancelled) return;
        setRecentOrdersLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setKpisLoading(true);

    api("/api/admin/dashboard/kpis")
      .then((response) => normalizeDashboardKpis(response))
      .then((next) => {
        if (cancelled) return;
        setKpis(next);
      })
      .catch(() => {
        if (cancelled) return;
        setKpis(normalizeDashboardKpis(null));
      })
      .finally(() => {
        if (cancelled) return;
        setKpisLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setMostSoldLoading(true);

    api("/api/mostSold?take=4&statuses=paid,shipped,delivered")
      .then((response) => normalizeMostSoldResponse(response))
      .then((result) => {
        if (cancelled) return;
        setMostSoldItems(result.items);
        setBestSeller(result.bestSeller);
      })
      .catch(() => {
        if (cancelled) return;
        setMostSoldItems([]);
        setBestSeller(null);
      })
      .finally(() => {
        if (cancelled) return;
        setMostSoldLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const fetchMonthlySales = async () => {
      setMonthlySalesLoading(true);
      const year = new Date().getFullYear();

      try {
        const response = await api(`/api/admin/dashboard/sales?year=${year}`);
        const extracted = extractMonthlySales(response);
        if (cancelled) return;
        setMonthlySales(extracted ?? EMPTY_MONTHLY_SERIES);
        setMonthlySalesUpdatedAt(new Date().toLocaleTimeString());
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (message !== "HTTP_404") {
          if (cancelled) return;
          setMonthlySales(EMPTY_MONTHLY_SERIES);
          setMonthlySalesUpdatedAt("");
          return;
        }
      }

      try {
        const [summary, kpisResponse] = await Promise.allSettled([
          api("/api/admin/dashboard/summary"),
          api("/api/admin/dashboard/kpis"),
        ]);
        if (cancelled) return;

        const extracted =
          (summary.status === "fulfilled" ? extractMonthlySales(summary.value) : null) ??
          (kpisResponse.status === "fulfilled" ? extractMonthlySales(kpisResponse.value) : null);

        setMonthlySales(extracted ?? EMPTY_MONTHLY_SERIES);
        setMonthlySalesUpdatedAt(extracted ? new Date().toLocaleTimeString() : "");
      } finally {
        if (cancelled) return;
        setMonthlySalesLoading(false);
      }
    };

    void fetchMonthlySales();
    timer = setInterval(fetchMonthlySales, 60_000);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, []);

  const totalStock = useMemo(() => {
    if (dashboardTotalStock !== null) return dashboardTotalStock;
    return stocks.reduce((sum, item) => sum + item.stock, 0);
  }, [dashboardTotalStock, stocks]);
  const lowStockCount = useMemo(
    () => stocks.filter((item) => item.status === "Low Stock" || item.status === "Out of Stock").length,
    [stocks]
  );

  const totalOrders = useMemo(() => kpis.ordersValue ?? recentOrders.length, [kpis.ordersValue, recentOrders.length]);
  const paidOrders = useMemo(
    () => kpis.paidOrdersValue ?? recentOrders.filter((item) => item.status === "paid").length,
    [kpis.paidOrdersValue, recentOrders]
  );
  const effectiveMonthlySales = useMemo(() => {
    if (monthlySales.some((value) => value > 0)) return monthlySales;
    if (kpis.totalSalesValue && kpis.totalSalesValue > 0) {
      const series = [...EMPTY_MONTHLY_SERIES];
      series[new Date().getMonth()] = kpis.totalSalesValue;
      return series;
    }
    return monthlySales;
  }, [kpis.totalSalesValue, monthlySales]);

  const mostSoldHeadline = useMemo(
    () => bestSeller ?? mostSoldItems[0] ?? null,
    [bestSeller, mostSoldItems],
  );
  const currency = useMemo(() => getCurrencyFormatter(), []);

  const saveChanges = () => {
    const now = new Date();
    setLastSaved(now.toLocaleTimeString());
  };

  const exportReport = useCallback(() => {
    if (typeof window === "undefined") return;

    const now = new Date();
    const generatedAt = now.toLocaleString("en-US", {
      year: "numeric",
      month: "long",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

    const safePdfText = (value: unknown) =>
      String(value ?? "")
        .replaceAll("\\", "\\\\")
        .replaceAll("(", "\\(")
        .replaceAll(")", "\\)")
        .replaceAll("\r", " ")
        .replaceAll("\n", " ");

    const last6 = (() => {
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const currentMonth = now.getMonth();
      const entries = Array.from({ length: 6 }, (_, index) => {
        const offset = 5 - index;
        const monthIndex = (currentMonth - offset + 12) % 12;
        return { label: monthNames[monthIndex], value: effectiveMonthlySales[monthIndex] ?? 0 };
      });
      return entries;
    })();

    const padOffset = (value: number) => String(value).padStart(10, "0");
    const toAsciiBytes = (value: string) => new TextEncoder().encode(value);

    const maxMonthly = Math.max(1, ...last6.map((item) => item.value));

    const totalSalesText = kpis.totalSalesValue !== null ? currency.format(kpis.totalSalesValue) : "—";
    const currentStocksText = stockLoading ? "—" : String(totalStock);
    const lowOutText = stockLoading ? "—" : String(lowStockCount);
    const reportsGeneratedText = kpisLoading ? "—" : String(kpis.reportsGeneratedValue ?? "—");
    const mostSoldNameText = mostSoldLoading ? "Loading…" : mostSoldHeadline?.name ?? "—";
    const mostSoldUnitsText = mostSoldLoading ? "—" : String(mostSoldHeadline?.quantitySold ?? "—");
    const mostSoldRevenueText = mostSoldLoading
      ? "—"
      : mostSoldHeadline
        ? currency.format(mostSoldHeadline.revenue)
        : "—";

    const lines: { size: number; x: number; y: number; text: string }[] = [
      { size: 18, x: 52, y: 800, text: "Katseye Insights Report" },
      { size: 10, x: 52, y: 784, text: "1 page summary • Admin Dashboard" },
      { size: 10, x: 390, y: 800, text: `Generated: ${generatedAt}` },
      { size: 10, x: 390, y: 784, text: `Last save: ${lastSaved || "—"}` },

      { size: 12, x: 52, y: 748, text: "Key Metrics" },
      { size: 10, x: 56, y: 730, text: `Total Sales: ${totalSalesText}` },
      { size: 10, x: 56, y: 715, text: `Orders: ${String(totalOrders)}` },
      { size: 10, x: 56, y: 700, text: `Paid Orders: ${String(paidOrders)}` },
      { size: 10, x: 56, y: 685, text: `Current Stocks: ${currentStocksText}` },
      { size: 10, x: 56, y: 670, text: `Low/Out of Stock: ${lowOutText}` },
      { size: 10, x: 56, y: 655, text: `Reports Generated (30d): ${reportsGeneratedText}` },

      { size: 12, x: 320, y: 748, text: "Sales Trend (Last 6 months)" },
      { size: 12, x: 52, y: 622, text: "Most Sold Item" },
      { size: 10, x: 56, y: 604, text: `Product: ${mostSoldNameText}` },
      { size: 10, x: 56, y: 589, text: `Units Sold: ${mostSoldUnitsText}` },
      { size: 10, x: 56, y: 574, text: `Revenue: ${mostSoldRevenueText}` },

      { size: 12, x: 320, y: 622, text: "Notes" },
      { size: 9, x: 320, y: 604, text: "This report is generated from the current dashboard state." },
    ];

    const rects: { x: number; y: number; w: number; h: number; fillRgb: [number, number, number] }[] = [];

    // Draw metric and notes boxes
    rects.push({ x: 48, y: 642, w: 250, h: 122, fillRgb: [0.98, 0.98, 0.99] });
    rects.push({ x: 312, y: 642, w: 236, h: 122, fillRgb: [0.98, 0.98, 0.99] });
    rects.push({ x: 48, y: 558, w: 250, h: 78, fillRgb: [0.98, 0.98, 0.99] });
    rects.push({ x: 312, y: 558, w: 236, h: 78, fillRgb: [0.98, 0.98, 0.99] });

    // Bar chart area
    const chartX = 322;
    const chartY = 654;
    const chartW = 216;
    const chartH = 82;
    rects.push({ x: chartX, y: chartY, w: chartW, h: chartH, fillRgb: [1, 1, 1] });

    const barGap = 10;
    const barW = 22;
    last6.forEach((item, index) => {
      const value = item.value;
      const barH = Math.max(2, Math.round((value / maxMonthly) * 62));
      const x = chartX + 10 + index * (barW + barGap);
      const y = chartY + 12;
      rects.push({ x, y, w: barW, h: barH, fillRgb: [0.15, 0.17, 0.45] });
      lines.push({ size: 8, x: x + 2, y: chartY + 2, text: item.label });
    });

    const contentParts: string[] = [];
    // Filled rectangles
    for (const r of rects) {
      const [rr, gg, bb] = r.fillRgb;
      contentParts.push(`${rr} ${gg} ${bb} rg`);
      contentParts.push(`${r.x} ${r.y} ${r.w} ${r.h} re f`);
    }
    // Borders
    contentParts.push(`0.90 0.91 0.93 RG 1 w`);
    contentParts.push(`48 642 250 122 re S`);
    contentParts.push(`312 642 236 122 re S`);
    contentParts.push(`48 558 250 78 re S`);
    contentParts.push(`312 558 236 78 re S`);
    contentParts.push(`0.85 0.86 0.90 RG 0.7 w`);
    contentParts.push(`${chartX} ${chartY} ${chartW} ${chartH} re S`);

    // Text
    for (const line of lines) {
      contentParts.push(`BT /F1 ${line.size} Tf ${line.x} ${line.y} Td (${safePdfText(line.text)}) Tj ET`);
    }

    const contentStream = contentParts.join("\n");
    const contentBytes = toAsciiBytes(contentStream);

    const objects: { id: number; body: Uint8Array }[] = [];
    const addObj = (id: number, body: string | Uint8Array) => {
      objects.push({ id, body: typeof body === "string" ? toAsciiBytes(body) : body });
    };

    // PDF objects
    addObj(1, `<< /Type /Catalog /Pages 2 0 R >>`);
    addObj(2, `<< /Type /Pages /Kids [3 0 R] /Count 1 >>`);
    addObj(
      3,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>`,
    );
    addObj(4, `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`);
    const streamHeader = toAsciiBytes(`<< /Length ${contentBytes.length} >>\nstream\n`);
    const streamFooter = toAsciiBytes(`\nendstream`);
    const streamBody = new Uint8Array(streamHeader.length + contentBytes.length + streamFooter.length);
    streamBody.set(streamHeader, 0);
    streamBody.set(contentBytes, streamHeader.length);
    streamBody.set(streamFooter, streamHeader.length + contentBytes.length);
    addObj(5, streamBody);

    // Build PDF file
    const header = toAsciiBytes(`%PDF-1.4\n%âãÏÓ\n`);
    const chunks: Uint8Array[] = [header];
    const xref: number[] = [0]; // object 0

    let offset = header.length;
    const writeChunk = (chunk: Uint8Array) => {
      chunks.push(chunk);
      offset += chunk.length;
    };

    objects.sort((a, b) => a.id - b.id);
    for (const obj of objects) {
      xref[obj.id] = offset;
      writeChunk(toAsciiBytes(`${obj.id} 0 obj\n`));
      writeChunk(obj.body);
      writeChunk(toAsciiBytes(`\nendobj\n`));
    }

    const xrefStart = offset;
    const maxObjId = Math.max(...objects.map((o) => o.id));
    const xrefLines = [`xref\n0 ${maxObjId + 1}\n`, `0000000000 65535 f \n`];
    for (let i = 1; i <= maxObjId; i++) {
      const off = xref[i] ?? 0;
      xrefLines.push(`${padOffset(off)} 00000 n \n`);
    }
    writeChunk(toAsciiBytes(xrefLines.join("")));

    const trailer = `trailer\n<< /Size ${maxObjId + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
    writeChunk(toAsciiBytes(trailer));

    const totalLen = chunks.reduce((sum, c) => sum + c.length, 0);
    const pdf = new Uint8Array(totalLen);
    let cursor = 0;
    for (const c of chunks) {
      pdf.set(c, cursor);
      cursor += c.length;
    }

    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const filename = `katseye-insights-report-${yyyy}-${mm}-${dd}.pdf`;

    const blob = new Blob([pdf], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }, [currency, effectiveMonthlySales, kpis, kpisLoading, lastSaved, lowStockCount, mostSoldHeadline, mostSoldLoading, paidOrders, stockLoading, totalOrders, totalStock]);

  return (
      <div className="mx-auto max-w-[1400px]">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-[#4f5ae0] dark:text-[#b59b39]">Admin Dashboard</p>
            <h1 className="text-4xl font-semibold tracking-tight">Katseye Insights</h1>
            <p className="mt-1 text-xs text-neutral-500 dark:text-[#c7ba81]">Last save: {lastSaved}</p>
          </div>
           <div className="flex items-center gap-2">
             <button
               type="button"
               className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-medium dark:border-[#2f2a16] dark:bg-[#090909]"
               onClick={exportReport}
             >
               Export Report
             </button>
             <button
               type="button"
               className="rounded-xl bg-[#272b74] px-4 py-2 text-sm font-medium text-white dark:bg-[#f1d04b] dark:text-[#090909]"
              onClick={saveChanges}
            >
              Save Changes
            </button>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 dark:bg-[#090909] dark:ring-[#2f2a16]">
            <p className="text-xs text-neutral-500">Current Stocks</p>
            <p className="mt-2 text-4xl font-semibold">{stockLoading ? "—" : totalStock}</p>
            <p className="mt-1 text-xs text-emerald-600">
              {stockLoading ? "Loading…" : `${lowStockCount} items need restock`}
            </p>
          </article>
          <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 dark:bg-[#090909] dark:ring-[#2f2a16]">
            <p className="text-xs text-neutral-500">Total Sales</p>
            <p className="mt-2 text-4xl font-semibold">
              {kpisLoading
                ? "—"
                : kpis.totalSalesValue !== null
                  ? currency.format(kpis.totalSalesValue)
                  : "—"}
            </p>
            <p className="mt-1 text-xs text-emerald-600">
              {kpisLoading
                ? "Loading…"
                : kpis.totalSalesChangePercent === null
                  ? "— this month"
                  : `${kpis.totalSalesChangePercent >= 0 ? "+" : ""}${kpis.totalSalesChangePercent.toFixed(1)}% this month`}
            </p>
          </article>
          <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 dark:bg-[#090909] dark:ring-[#2f2a16]">
            <p className="text-xs text-neutral-500">Orders</p>
            <p className="mt-2 text-4xl font-semibold">{totalOrders}</p>
            <p className="mt-1 text-xs text-emerald-600">{paidOrders} paid orders</p>
          </article>
          <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 dark:bg-[#090909] dark:ring-[#2f2a16]">
            <p className="text-xs text-neutral-500">Reports Generated</p>
            <p className="mt-2 text-4xl font-semibold">
              {kpisLoading ? "—" : kpis.reportsGeneratedValue ?? "—"}
            </p>
            <p className="mt-1 text-xs text-neutral-500">Last 30 days</p>
          </article>
          <article className="rounded-2xl bg-[linear-gradient(135deg,#4a4bb6,#3a8bd8)] p-4 text-white shadow-sm dark:bg-[linear-gradient(135deg,#d9b92f,#f1d04b)] dark:text-[#090909]">
            <p className="text-xs text-white/80">Most Sold Item</p>
            <p className="mt-2 text-2xl font-semibold">
              {mostSoldLoading ? "Loading…" : mostSoldHeadline?.name ?? "—"}
            </p>
            <p className="mt-1 text-xs text-white/80">
              {mostSoldLoading
                ? "Fetching order totals…"
                : mostSoldHeadline
                  ? `${mostSoldHeadline.quantitySold} units sold`
                  : "No sales data yet"}
            </p>
          </article>
        </section>

        <section className="mt-6 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 dark:bg-[#090909] dark:ring-[#2f2a16]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Current Stocks</h2>
              <span className="text-xs text-neutral-500">Low threshold: {stockLowThreshold}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                    <th className="pb-2">Product</th>
                    <th className="pb-2">SKU</th>
                    <th className="pb-2">Stock Qty</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stockLoading ? (
                    <tr className="border-b border-neutral-100">
                      <td className="py-3 text-neutral-500" colSpan={4}>
                        Loading current stocks…
                      </td>
                    </tr>
                  ) : (
                    stocks.map((item) => (
                      <tr key={item.id} className="border-b border-neutral-100">
                        <td className="py-3 font-medium">{item.name}</td>
                        <td className="py-3 text-neutral-500">{item.sku}</td>
                        <td className="py-3 font-medium">{item.stock}</td>
                        <td className="py-3">
                          <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusPill(item.status)}`}>
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </article>

          <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 dark:bg-[#090909] dark:ring-[#2f2a16]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Sales Report</h2>
              <span className="text-xs text-neutral-500">Jan - Dec</span>
            </div>
            <div className="flex h-56 items-end gap-2 rounded-xl bg-[#f8f9fe] p-3 dark:bg-[#11110f]">
              {monthlySalesLoading ? (
                <p className="w-full self-center text-center text-sm text-neutral-500">
                  Loading sales chart…
                </p>
              ) : effectiveMonthlySales.every((value) => value === 0) ? (
                <p className="w-full self-center text-center text-sm text-neutral-500">
                  No sales data available yet.
                </p>
              ) : (
                effectiveMonthlySales.map((value, index) => (
                  <div
                    key={index}
                    className="flex-1 rounded-t-md bg-[#6f83e9]"
                    style={{
                      height: `${Math.max(6, (value / Math.max(...effectiveMonthlySales)) * 100)}%`,
                    }}
                    title={`Month ${index + 1}: ${value}`}
                  />
                ))
              )}
            </div>
            <p className="mt-3 text-xs text-neutral-500">
              {monthlySalesUpdatedAt
                ? `Updated ${monthlySalesUpdatedAt}`
                : kpis.totalSalesValue && kpis.totalSalesValue > 0
                  ? "Showing total sales for the current month."
                  : "Connect backend sales data to show monthly totals."}
            </p>
          </article>
        </section>

        <section className="mt-6 grid gap-4 xl:grid-cols-2">
          <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 dark:bg-[#090909] dark:ring-[#2f2a16]">
            <h2 className="mb-3 text-xl font-semibold">Recent Orders</h2>
            <div className="space-y-2">
              {recentOrdersLoading ? (
                <div className="rounded-xl border border-neutral-200 px-3 py-3 text-sm text-neutral-500 dark:border-[#2f2a16] dark:bg-[#11110f]">
                  Loading recent orders…
                </div>
              ) : recentOrders.length === 0 ? (
                <div className="rounded-xl border border-neutral-200 px-3 py-3 text-sm text-neutral-500 dark:border-[#2f2a16] dark:bg-[#11110f]">
                  No recent orders found.
                </div>
              ) : (
                recentOrders.map((order) => (
                  <Link
                    key={order.id}
                    href={{
                      pathname: "/admin/order_tracker",
                      query: {
                        orderId: order.id,
                        orderNumber: order.orderNumber,
                        userEmail: order.userEmail,
                        userName: order.userName,
                      },
                    }}
                    className="group block rounded-xl border border-neutral-200 px-3 py-2 transition hover:border-neutral-300 hover:bg-black/5 dark:border-[#2f2a16] dark:bg-[#11110f] dark:hover:bg-[#0b0b0a]"
                    aria-label={`View order ${order.orderNumber || order.id} in Order Tracker`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium">
                            #{order.orderNumber || order.id}
                          </p>
                          <span
                            className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${statusPill(order.status)}`}
                          >
                            {order.status}
                          </span>
                        </div>
                        <p className="truncate text-xs text-neutral-500">
                          {order.userEmail || order.userName}
                        </p>
                        {order.itemTitles.length > 0 ? (
                          <p className="mt-1 truncate text-xs text-neutral-500">
                            {order.itemTitles.join(", ")}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-3">
                        <p className="text-sm font-semibold">
                          ${Number.isFinite(order.totalAmount) ? order.totalAmount.toFixed(2) : "0.00"}
                        </p>
                        <span className="text-neutral-400 transition group-hover:translate-x-0.5 dark:text-[#8e7727]">
                          →
                        </span>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </article>

          <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 dark:bg-[#090909] dark:ring-[#2f2a16]">
            <h2 className="mb-3 text-xl font-semibold">Most Sale Items</h2>
            <div className="space-y-3">
              {mostSoldLoading ? (
                <div className="rounded-xl border border-neutral-200 px-3 py-3 text-sm text-neutral-500 dark:border-[#2f2a16] dark:bg-[#11110f]">
                  Loading most sold items…
                </div>
              ) : mostSoldItems.length === 0 ? (
                <div className="rounded-xl border border-neutral-200 px-3 py-3 text-sm text-neutral-500 dark:border-[#2f2a16] dark:bg-[#11110f]">
                  No sales data found.
                </div>
              ) : (
                mostSoldItems.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between rounded-xl bg-[#f6f7fc] px-3 py-2 dark:bg-[#11110f]"
                  >
                    <div className="flex items-center gap-3">
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-[#4a4bb6] text-xs font-semibold text-white">
                        {item.rank}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{item.name}</p>
                        <p className="text-xs text-neutral-500">{item.quantitySold} sold</p>
                      </div>
                    </div>
                    <p className="text-sm font-semibold">{currency.format(item.revenue)}</p>
                  </div>
                ))
              )}
            </div>
          </article>
        </section>
      </div>
  );
}
