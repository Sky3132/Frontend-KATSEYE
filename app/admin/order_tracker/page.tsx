"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, asNumber, asString, unwrapList, unwrapObject } from "../../lib/api";

function EmptyState({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="grid h-full place-items-center px-6 py-12 text-center">
      <div className="max-w-[280px]">
        <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-[#eef2ff] dark:bg-[#11110f]">
          <div className="relative grid h-16 w-16 place-items-center rounded-2xl bg-[#38bdf8] text-white shadow-sm dark:bg-[#f1d04b] dark:text-[#090909]">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M7 3h7l3 3v15a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <path
                d="M14 3v3h3"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <path
                d="M8 11h8M8 15h6"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute -bottom-2 grid h-7 w-7 place-items-center rounded-full bg-[#111827] text-white shadow-sm dark:bg-[#090909]">
              +
            </span>
          </div>
        </div>
        <p className="mt-4 text-sm font-semibold text-[#111827] dark:text-[#f1d04b]">
          {title}
        </p>
        <p className="mt-1 text-xs text-neutral-500 dark:text-[#c7ba81]">
          {subtitle}
        </p>
      </div>
    </div>
  );
}

type TrackerTab =
  | "all"
  | "new"
  | "in_progress"
  | "awaiting_pickup"
  | "dispatched"
  | "completed"
  | "cancelled";

type SummaryStatusCounts = Partial<Record<TrackerTab, number>>;

type TrackerSummary = {
  totalOrdersToday: number;
  pendingOrdersToday: number;
  totalRevenueToday: number;
  customerFeedbackToday: number;
  statusCounts: SummaryStatusCounts;
};

type TrackerListItem = {
  id: string;
  orderNumber: string;
  userLabel: string;
  totalAmount: number;
  orderDate: string;
  trackerStatus: string;
  status: string;
};

type TrackerListResponse = {
  items: TrackerListItem[];
  total: number;
  page: number;
  take: number;
};

type OrderStatusPatch =
  | "pending"
  | "paid"
  | "shipped"
  | "delivered"
  | "cancelled";

type LocalShipment = {
  carrier: string;
  trackingNumber: string;
  createdAt: string;
};

type OrderDetailItem = {
  title: string;
  variant: string;
  quantity: number;
  unitPrice: number | null;
};

type OrderDetail = {
  id: string;
  orderNumber: string;
  orderDate: string;
  trackerStatus: string;
  status: string;
  paymentMethod: string;
  totalAmount: number;
  userName: string;
  userEmail: string;
  addressLines: string[];
  shipmentCarrier: string;
  shipmentTrackingNumber: string;
  shipmentTrackingUrl: string;
  items: OrderDetailItem[];
};

const TABS: { label: string; value: TrackerTab }[] = [
  { label: "All", value: "all" },
  { label: "New", value: "new" },
  { label: "In Progress", value: "in_progress" },
  { label: "Awaiting Pickup", value: "awaiting_pickup" },
  { label: "Dispatched", value: "dispatched" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
];

const normalizeTab = (value: string | null): TrackerTab => {
  const lowered = String(value ?? "").trim().toLowerCase();
  const match = TABS.find((tab) => tab.value === lowered);
  return match?.value ?? "all";
};

const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    Number.isFinite(value) ? value : 0,
  );

const formatDateTime = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value || "—";
  return parsed.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const trackerStatusPill = (status: string) => {
  const normalized = status.trim().toLowerCase();
  if (normalized === "completed") return "bg-emerald-100 text-emerald-700";
  if (normalized === "cancelled" || normalized === "canceled")
    return "bg-rose-100 text-rose-700";
  if (normalized === "dispatched") return "bg-blue-100 text-blue-700";
  if (normalized === "awaiting pickup" || normalized === "awaiting_pickup")
    return "bg-amber-100 text-amber-700";
  if (normalized === "in progress" || normalized === "in_progress")
    return "bg-violet-100 text-violet-700";
  if (normalized === "new") return "bg-slate-100 text-slate-700";
  return "bg-neutral-100 text-neutral-700";
};

const buildQueryString = (
  params: Record<string, string | number | null | undefined>,
) => {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (!text) continue;
    searchParams.set(key, text);
  }
  const query = searchParams.toString();
  return query ? `?${query}` : "";
};

const LOCAL_SHIPMENT_PREFIX = "katseye_order_shipment:";

const hashString = (value: string) => {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return hash >>> 0;
};

const computeShipmentForOrder = (orderId: string) => {
  const safe = String(orderId ?? "").trim();
  const hash = hashString(safe || "order");
  const trackingNumber = `KX-${hash.toString(36).toUpperCase().padStart(8, "0")}`;
  const carrier = `KATSEYE Carrier ${String(hash % 10_000).padStart(4, "0")}`;
  return { trackingNumber, carrier };
};

const readLocalShipment = (orderId: string): LocalShipment | null => {
  if (typeof window === "undefined") return null;
  const key = `${LOCAL_SHIPMENT_PREFIX}${orderId}`;
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<LocalShipment>;
    const carrier = String(parsed.carrier ?? "").trim();
    const trackingNumber = String(parsed.trackingNumber ?? "").trim();
    const createdAt = String(parsed.createdAt ?? "").trim();
    if (!carrier || !trackingNumber) return null;
    return {
      carrier,
      trackingNumber,
      createdAt: createdAt || new Date().toISOString(),
    };
  } catch {
    return null;
  }
};

const writeLocalShipment = (orderId: string, shipment: LocalShipment) => {
  if (typeof window === "undefined") return;
  const key = `${LOCAL_SHIPMENT_PREFIX}${orderId}`;
  window.localStorage.setItem(key, JSON.stringify(shipment));
};

const normalizeSummary = (value: unknown): TrackerSummary => {
  const record = unwrapObject(value) ?? unwrapObject(unwrapObject(value)?.data);
  if (!record) {
    return {
      totalOrdersToday: 0,
      pendingOrdersToday: 0,
      totalRevenueToday: 0,
      customerFeedbackToday: 0,
      statusCounts: {},
    };
  }

  const rawStatusCounts =
    unwrapObject(record.statusCounts ?? record.status_counts) ?? null;
  const statusCounts: SummaryStatusCounts = {};
  if (rawStatusCounts) {
    for (const tab of TABS) {
      const count = asNumber(rawStatusCounts[tab.value], Number.NaN);
      if (Number.isFinite(count)) {
        statusCounts[tab.value] = Math.max(0, Math.floor(count));
      }
    }
  }

  return {
    totalOrdersToday: Math.max(
      0,
      Math.floor(
        asNumber(record.totalOrdersToday ?? record.total_orders_today, 0),
      ),
    ),
    pendingOrdersToday: Math.max(
      0,
      Math.floor(
        asNumber(record.pendingOrdersToday ?? record.pending_orders_today, 0),
      ),
    ),
    totalRevenueToday: Math.max(
      0,
      asNumber(record.totalRevenueToday ?? record.total_revenue_today, 0),
    ),
    customerFeedbackToday: Math.max(
      0,
      Math.floor(
        asNumber(
          record.customerFeedbackToday ?? record.customer_feedback_today,
          0,
        ),
      ),
    ),
    statusCounts,
  };
};

const normalizeTrackerList = (value: unknown): TrackerListResponse => {
  const record = unwrapObject(value) ?? unwrapObject(unwrapObject(value)?.data);
  const itemsRaw = record
    ? unwrapList(record.items ?? record.results ?? record.data)
    : unwrapList(value);

  const items = itemsRaw
    .map((item) => unwrapObject(item))
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((item, index): TrackerListItem => {
      const idCandidate =
        item.id ??
        item.order_id ??
        item.orderId ??
        item.orderID ??
        item.order_number ??
        index;
      const id = asString(idCandidate);
      const orderNumber = asString(item.order_number ?? item.orderNumber ?? "");
      const user = unwrapObject(item.user);
      const userLabel = asString(
        user?.email ??
          user?.name ??
          item.user_email ??
          item.userEmail ??
          item.user_name ??
          item.userName ??
          "",
      );
      const orderDate = asString(item.order_date ?? item.orderDate ?? "");
      const trackerStatus = asString(
        item.tracker_status ??
          item.trackerStatus ??
          item.tracker_status_label ??
          item.status_label ??
          "",
      );
      const status = asString(item.status ?? item.payment_status ?? "");

      return {
        id,
        orderNumber,
        userLabel,
        totalAmount: asNumber(item.total_amount ?? item.totalAmount, 0),
        orderDate,
        trackerStatus: trackerStatus || status,
        status,
      };
    })
    .filter((item) => Boolean(item.id));

  const total = record ? asNumber(record.total, items.length) : items.length;
  const page = record ? Math.max(1, Math.floor(asNumber(record.page, 1))) : 1;
  const take = record ? Math.max(1, Math.floor(asNumber(record.take, 25))) : 25;
  return { items, total, page, take };
};

const normalizeAddressLines = (address: Record<string, unknown> | null) => {
  if (!address) return [];
  const parts = [
    asString(address.line1 ?? address.address1 ?? address.address_line1 ?? ""),
    asString(address.line2 ?? address.address2 ?? address.address_line2 ?? ""),
    asString(address.city ?? ""),
    asString(address.state ?? address.province ?? ""),
    asString(address.postal_code ?? address.zip ?? address.postalCode ?? ""),
    asString(address.country ?? ""),
  ]
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [];
};

const normalizeAddressName = (address: Record<string, unknown> | null) => {
  if (!address) return "";
  return asString(address.full_name ?? address.fullName ?? address.name ?? "", "").trim();
};

const normalizeOrderDetail = (
  value: unknown,
  fallbackId: string,
): OrderDetail => {
  const record =
    unwrapObject(value) ?? unwrapObject(unwrapObject(value)?.data) ?? {};
  const resolvedId = asString(record.id ?? record.order_id ?? record.orderId ?? fallbackId);
  const user = unwrapObject(record.user);
  const address = unwrapObject(
    record.address ?? record.shipping_address ?? record.shippingAddress,
  );
  const shipment = unwrapObject(record.shipment);
  const localShipment = readLocalShipment(resolvedId);
  const rawItems = unwrapList(
    record.items ?? record.order_items ?? record.orderItems,
  );
  const items = rawItems
    .map((item) => unwrapObject(item))
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((item): OrderDetailItem => {
      const product = unwrapObject(item.product) ?? unwrapObject(item.item);
      return {
        title: asString(
          item.title ??
            item.name ??
            item.product_title ??
            item.productTitle ??
            product?.title ??
            product?.name ??
            "Item",
        ),
        variant: asString(item.variant_name ?? item.variantName ?? ""),
        quantity: Math.max(
          1,
          Math.floor(asNumber(item.quantity ?? item.qty ?? item.count, 1)),
        ),
        unitPrice: (() => {
          const price = asNumber(
            item.unit_price ?? item.price ?? item.unitPrice,
            Number.NaN,
          );
          return Number.isFinite(price) ? price : null;
        })(),
      };
    });

  return {
    id: resolvedId,
    orderNumber: asString(record.order_number ?? record.orderNumber ?? ""),
    orderDate: asString(record.order_date ?? record.orderDate ?? ""),
    trackerStatus: asString(
      record.tracker_status ??
        record.trackerStatus ??
        record.tracker_status_label ??
        "",
    ),
    status: asString(record.status ?? record.payment_status ?? ""),
    paymentMethod: asString(record.payment_method ?? record.paymentMethod ?? ""),
    totalAmount: asNumber(record.total_amount ?? record.totalAmount, 0),
    userName:
      normalizeAddressName(address) ||
      asString(user?.name ?? record.user_name ?? record.userName ?? ""),
    userEmail: asString(
      user?.email ?? record.user_email ?? record.userEmail ?? "",
    ),
    addressLines: normalizeAddressLines(address),
    shipmentCarrier:
      asString(shipment?.carrier ?? shipment?.shipping_carrier ?? "") ||
      localShipment?.carrier ||
      "",
    shipmentTrackingNumber:
      asString(
        shipment?.tracking_number ??
          shipment?.trackingNumber ??
          shipment?.tracking_no ??
          "",
      ) ||
      localShipment?.trackingNumber ||
      "",
    shipmentTrackingUrl: asString(
      shipment?.tracking_url ?? shipment?.trackingUrl ?? "",
    ),
    items,
  };
};

export default function OrderTrackerPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const didInitRef = useRef(false);
  const [tab, setTab] = useState<TrackerTab>("all");
  const [page, setPage] = useState(1);
  const [take] = useState(25);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState("");

  const [summary, setSummary] = useState<TrackerSummary>(() => ({
    totalOrdersToday: 0,
    pendingOrdersToday: 0,
    totalRevenueToday: 0,
    customerFeedbackToday: 0,
    statusCounts: {},
  }));
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [list, setList] = useState<TrackerListResponse>(() => ({
    items: [],
    total: 0,
    page: 1,
    take: 25,
  }));
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);

  const totalPages = useMemo(() => {
    const pages = Math.ceil((list.total || 0) / (list.take || take));
    return Math.max(1, Number.isFinite(pages) ? pages : 1);
  }, [list.take, list.total, take]);

  const activeTabLabel = useMemo(
    () => TABS.find((item) => item.value === tab)?.label ?? "All",
    [tab],
  );

  const syncUrl = (
    next: Partial<{
      tab: TrackerTab;
      page: number;
      search: string;
      orderId: string;
    }>,
  ) => {
    const query = buildQueryString({
      tab: next.tab ?? tab,
      page: next.page ?? page,
      take,
      search: next.search ?? search,
      orderId: next.orderId ?? selectedOrderId,
    });
    router.replace(`/admin/order_tracker${query}`);
  };

  const getBadgeCount = (value: TrackerTab) => {
    if (value === "all") {
      const total = Object.values(summary.statusCounts).reduce(
        (sum, item) => sum + (Number.isFinite(item) ? item : 0),
        0,
      );
      return Math.max(0, Math.floor(total));
    }
    return Math.max(0, Math.floor(summary.statusCounts[value] ?? 0));
  };

  const refetchSummary = async () => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const response = await api("/api/admin/orders/tracker/summary");
      setSummary(normalizeSummary(response));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load summary.";
      setSummaryError(message);
    } finally {
      setSummaryLoading(false);
    }
  };

  const refetchList = async (next: {
    tab: TrackerTab;
    page: number;
    search: string;
  }) => {
    setListLoading(true);
    setListError(null);
    try {
      const query = buildQueryString({
        tab: next.tab,
        page: next.page,
        take,
        search: next.search,
      });
      const response = await api(`/api/admin/orders/tracker${query}`);
      setList(normalizeTrackerList(response));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load orders.";
      setListError(message);
      setList({ items: [], total: 0, page: next.page, take });
    } finally {
      setListLoading(false);
    }
  };

  const refetchDetail = async (orderId: string) => {
    if (!orderId) {
      setDetail(null);
      setDetailError(null);
      return;
    }

    setDetailLoading(true);
    setDetailError(null);

    try {
      const response = await api(`/api/admin/orders/${orderId}`);
      setDetail(normalizeOrderDetail(response, orderId));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load order detail.";
      setDetail(null);
      setDetailError(message);
    } finally {
      setDetailLoading(false);
    }
  };

  const updateStatus = async (nextStatus: OrderStatusPatch) => {
    if (!detail?.id) return;
    if (statusUpdating) return;

    setStatusUpdating(true);
    setDetailError(null);
    try {
      const patchBody: Record<string, unknown> = { status: nextStatus };
      if (nextStatus === "shipped") {
        const existingTracking =
          detail.shipmentTrackingNumber.trim() || readLocalShipment(detail.id)?.trackingNumber || "";
        const existingCarrier =
          detail.shipmentCarrier.trim() || readLocalShipment(detail.id)?.carrier || "";

        const generated = computeShipmentForOrder(detail.id);
        const trackingNumber = existingTracking || generated.trackingNumber;
        const carrier = existingCarrier || generated.carrier;

        writeLocalShipment(detail.id, {
          trackingNumber,
          carrier,
          createdAt: new Date().toISOString(),
        });

        patchBody.trackingNumber = trackingNumber;
        patchBody.tracking_number = trackingNumber;
        patchBody.carrier = carrier;
        patchBody.shipment = {
          trackingNumber,
          tracking_number: trackingNumber,
          carrier,
        };
      }

      await api(`/api/admin/orders/${detail.id}/status`, {
        method: "PATCH",
        body: JSON.stringify(patchBody),
      });
      await Promise.all([
        refetchSummary(),
        refetchList({ tab, page, search }),
        refetchDetail(detail.id),
      ]);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update status.";
      setDetailError(message);
    } finally {
      setStatusUpdating(false);
    }
  };

  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;

    setTab(normalizeTab(searchParams.get("tab")));
    setPage(
      Math.max(
        1,
        Math.floor(Number(searchParams.get("page") ?? "1") || 1),
      ),
    );
    const initialSearch = asString(searchParams.get("search") ?? "");
    setSearchDraft(initialSearch);
    setSearch(initialSearch);
    setSelectedOrderId(asString(searchParams.get("orderId") ?? ""));
  }, [searchParams]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const next = searchDraft.trim();
      setSearch((prev) => (prev === next ? prev : next));
      setPage(1);
    }, 350);

    return () => window.clearTimeout(handle);
  }, [searchDraft]);

  useEffect(() => {
    void refetchSummary();
  }, []);

  useEffect(() => {
    void refetchList({ tab, page, search });
    syncUrl({ tab, page, search });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, page, search]);

  useEffect(() => {
    syncUrl({ orderId: selectedOrderId });
    void refetchDetail(selectedOrderId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrderId]);

  const cards = useMemo(
    () => [
      {
        label: "Total Orders Today",
        render: summaryLoading ? "—" : String(summary.totalOrdersToday),
      },
      {
        label: "Pending Orders Today",
        render: summaryLoading ? "—" : String(summary.pendingOrdersToday),
      },
      {
        label: "Total Revenue Today",
        render: summaryLoading ? "—" : formatMoney(summary.totalRevenueToday),
      },
      {
        label: "Customer Feedback Today",
        render: summaryLoading ? "—" : String(summary.customerFeedbackToday),
      },
    ],
    [summary, summaryLoading],
  );

  const orderNumber = searchParams.get("orderNumber") ?? "";
  const userEmail = searchParams.get("userEmail") ?? "";
  const userName = searchParams.get("userName") ?? "";

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#111827] dark:text-[#f1d04b]">
            Order Tracker
          </h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-[#c7ba81]">
            {orderNumber || selectedOrderId ? (
              <>
                Viewing{" "}
                <span className="font-semibold text-neutral-800 dark:text-[#f1d04b]">
                  #{orderNumber || selectedOrderId}
                </span>
                {userEmail || userName ? (
                  <>
                    {" "}
                    for{" "}
                    <span className="font-semibold text-neutral-800 dark:text-[#f1d04b]">
                      {userEmail || userName}
                    </span>
                  </>
                ) : null}
                .
              </>
            ) : (
              "Select an order from the Admin Dashboard to view it here."
            )}
          </p>
          {summaryError ? (
            <p className="mt-2 text-xs text-rose-600 dark:text-rose-300">
              {summaryError}
            </p>
          ) : null}
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <article
            key={card.label}
            className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 dark:bg-[#090909] dark:ring-[#2f2a16]"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs font-medium text-neutral-500 dark:text-[#c7ba81]">
                {card.label}
              </p>
              <span className="grid h-8 w-8 place-items-center rounded-2xl bg-black/5 text-[#111827] dark:bg-[#11110f] dark:text-[#f1d04b]">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M7 7h10M7 12h10M7 17h6"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </div>
            <p className="mt-3 text-xl font-semibold text-[#111827] dark:text-[#f1d04b]">
              {card.render}
            </p>
          </article>
        ))}
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5 dark:bg-[#090909] dark:ring-[#2f2a16]">
        <div className="flex flex-wrap gap-2">
          {TABS.map((item) => {
            const active = item.value === tab;
            const count = getBadgeCount(item.value);
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => {
                  setTab(item.value);
                  setPage(1);
                  setSelectedOrderId("");
                }}
                className={`inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold transition ${
                  active
                    ? "bg-[#111827] text-white dark:bg-[#f1d04b] dark:text-[#090909]"
                    : "text-[#111827] hover:bg-black/5 dark:text-[#f1d04b] dark:hover:bg-[#11110f]"
                }`}
              >
                {item.label}
                <span
                  className={`grid min-w-[28px] place-items-center rounded-full px-2 py-1 text-[11px] font-semibold ${
                    active
                      ? "bg-white/20 text-white dark:bg-black/20 dark:text-[#090909]"
                      : "bg-black/5 text-[#111827] dark:bg-[#11110f] dark:text-[#f1d04b]"
                  }`}
                >
                  {summaryLoading ? "—" : String(count)}
                </span>
              </button>
            );
          })}
        </div>
        <div className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white/80 px-4 py-2 text-xs font-semibold text-[#111827] backdrop-blur dark:border-[#2b2613] dark:bg-[#090909] dark:text-[#f1d04b]">
          <span className="text-neutral-500 dark:text-[#c7ba81]">Tab:</span>{" "}
          {activeTabLabel}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[420px_1fr]">
        <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 dark:bg-[#090909] dark:ring-[#2f2a16]">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-[#111827] dark:text-[#f1d04b]">
                Orders
              </h2>
              <p className="mt-1 text-sm text-neutral-500 dark:text-[#c7ba81]">
                {listLoading ? "Loading…" : `${list.total} total`} ·{" "}
                {activeTabLabel}
              </p>
            </div>
            <div className="text-xs text-neutral-500 dark:text-[#c7ba81]">
              Page {page} / {totalPages}
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <input
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Search order number, name, or email"
              className="h-11 w-full rounded-2xl border border-neutral-300 bg-white px-4 text-sm outline-none transition focus:border-[#111827] dark:border-[#2f2a16] dark:bg-[#080808] dark:text-[#f1d04b] dark:focus:border-[#d9b92f]"
            />

            {listError ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/20 dark:text-rose-200">
                {listError}
              </div>
            ) : null}

            {listLoading ? (
              <div className="rounded-xl border border-neutral-200 px-3 py-3 text-sm text-neutral-500 dark:border-[#2f2a16] dark:bg-[#11110f]">
                Loading orders…
              </div>
            ) : list.items.length === 0 ? (
              <div className="rounded-xl border border-neutral-200 px-3 py-3 text-sm text-neutral-500 dark:border-[#2f2a16] dark:bg-[#11110f]">
                No orders found.
              </div>
            ) : (
              <div className="space-y-2">
                {list.items.map((item) => {
                  const active = item.id === selectedOrderId;
                  const statusLabel = item.trackerStatus || item.status || "—";
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedOrderId(item.id)}
                      className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                        active
                          ? "border-[#111827] bg-[#f8f8fb] dark:border-[#d9b92f] dark:bg-[#12110d]"
                          : "border-neutral-200 bg-white hover:bg-black/5 dark:border-[#2f2a16] dark:bg-[#11110f] dark:hover:bg-[#0b0b0a]"
                      }`}
                      aria-pressed={active}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            #{item.orderNumber || item.id}
                          </p>
                          <p className="truncate text-xs text-neutral-500 dark:text-[#c7ba81]">
                            {item.userLabel || "Unknown user"}
                          </p>
                          <p className="mt-1 truncate text-[11px] text-neutral-500 dark:text-[#8e7727]">
                            {formatDateTime(item.orderDate)}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span
                            className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${trackerStatusPill(
                              statusLabel,
                            )}`}
                          >
                            {statusLabel}
                          </span>
                          <p className="text-sm font-semibold">
                            {formatMoney(item.totalAmount)}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-2 flex items-center justify-between gap-3">
              <button
                type="button"
                disabled={page <= 1 || listLoading}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                className="h-10 rounded-2xl border border-neutral-300 bg-white px-4 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#2f2a16] dark:bg-[#080808] dark:text-[#f1d04b]"
              >
                Prev
              </button>
              <button
                type="button"
                disabled={page >= totalPages || listLoading}
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                className="h-10 rounded-2xl border border-neutral-300 bg-white px-4 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#2f2a16] dark:bg-[#080808] dark:text-[#f1d04b]"
              >
                Next
              </button>
            </div>
          </div>
        </article>

        <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 dark:bg-[#090909] dark:ring-[#2f2a16]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-[#111827] dark:text-[#f1d04b]">
                Order Detail
              </h2>
              <p className="mt-1 text-sm text-neutral-500 dark:text-[#c7ba81]">
                {detail?.orderNumber || detail?.id
                  ? `#${detail.orderNumber || detail.id}`
                  : "Select an order to view details."}
              </p>
            </div>

            {detail?.id ? (
              <select
                value={(detail.status || "pending").toLowerCase()}
                disabled={statusUpdating}
                onChange={(event) =>
                  void updateStatus(event.target.value as OrderStatusPatch)
                }
                className="h-10 rounded-2xl border border-neutral-300 bg-white px-3 text-sm outline-none transition disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#2f2a16] dark:bg-[#080808] dark:text-[#f1d04b]"
                aria-label="Update order status"
              >
                <option value="pending">pending</option>
                <option value="paid">paid</option>
                <option value="shipped">shipped</option>
                <option value="delivered">delivered</option>
                <option value="cancelled">cancelled</option>
              </select>
            ) : null}
          </div>

          {detailError ? (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/20 dark:text-rose-200">
              {detailError}
            </div>
          ) : null}

          {detailLoading ? (
            <div className="mt-4 rounded-xl border border-neutral-200 px-3 py-3 text-sm text-neutral-500 dark:border-[#2f2a16] dark:bg-[#11110f]">
              Loading order detail…
            </div>
          ) : !detail ? (
            <div className="mt-4">
              <EmptyState
                title="No order selected"
                subtitle="Pick an order from the list to see customer info, items, and shipment details."
              />
            </div>
          ) : (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="space-y-3 rounded-2xl border border-neutral-200 bg-[#fafafa] p-4 dark:border-[#2f2a16] dark:bg-[#11110f]">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500 dark:text-[#c7ba81]">
                  Summary
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-neutral-500 dark:text-[#c7ba81]">
                      Order date
                    </span>
                    <span className="font-medium">
                      {formatDateTime(detail.orderDate)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-neutral-500 dark:text-[#c7ba81]">
                      Tracker status
                    </span>
                    <span
                      className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${trackerStatusPill(
                        detail.trackerStatus || detail.status,
                      )}`}
                    >
                      {detail.trackerStatus || detail.status || "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-neutral-500 dark:text-[#c7ba81]">
                      Payment method
                    </span>
                    <span className="font-medium">
                      {detail.paymentMethod || "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-neutral-500 dark:text-[#c7ba81]">
                      Total
                    </span>
                    <span className="font-semibold">
                      {formatMoney(detail.totalAmount)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-neutral-200 bg-[#fafafa] p-4 dark:border-[#2f2a16] dark:bg-[#11110f]">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500 dark:text-[#c7ba81]">
                  Customer
                </p>
                <div className="space-y-1 text-sm">
                  <p className="font-medium">{detail.userName || "—"}</p>
                  <p className="text-neutral-500 dark:text-[#c7ba81]">
                    {detail.userEmail || "—"}
                  </p>
                </div>
                <div className="pt-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500 dark:text-[#c7ba81]">
                    Address
                  </p>
                  {detail.addressLines.length === 0 ? (
                    <p className="mt-1 text-sm text-neutral-500 dark:text-[#c7ba81]">
                      —
                    </p>
                  ) : (
                    <ul className="mt-1 space-y-1 text-sm text-neutral-700 dark:text-[#f1d04b]">
                      {detail.addressLines.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-[#2f2a16] dark:bg-[#090909] lg:col-span-2">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500 dark:text-[#c7ba81]">
                    Shipment
                  </p>
                  {detail.shipmentTrackingUrl ? (
                    <a
                      href={detail.shipmentTrackingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-[#4f5ae0] hover:underline dark:text-[#f1d04b]"
                    >
                      Open tracking
                    </a>
                  ) : null}
                </div>
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-neutral-500 dark:text-[#c7ba81]">
                      Carrier
                    </p>
                    <p className="font-medium">
                      {detail.shipmentCarrier || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500 dark:text-[#c7ba81]">
                      Tracking number
                    </p>
                    <p className="font-medium">
                      {detail.shipmentTrackingNumber || "—"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-[#2f2a16] dark:bg-[#090909] lg:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500 dark:text-[#c7ba81]">
                  Items
                </p>
                {detail.items.length === 0 ? (
                  <p className="text-sm text-neutral-500 dark:text-[#c7ba81]">
                    No items.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {detail.items.map((item, index) => (
                      <div
                        key={`${item.title}-${index}`}
                        className="flex flex-wrap items-start justify-between gap-2 rounded-xl bg-[#fafafa] px-3 py-2 dark:bg-[#11110f]"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {item.title}
                          </p>
                          <p className="truncate text-xs text-neutral-500 dark:text-[#c7ba81]">
                            {item.variant ? item.variant : "Default"} · Qty{" "}
                            {item.quantity}
                          </p>
                        </div>
                        <p className="text-sm font-semibold">
                          {item.unitPrice === null
                            ? "—"
                            : formatMoney(item.unitPrice)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </article>
      </section>
    </section>
  );
}
