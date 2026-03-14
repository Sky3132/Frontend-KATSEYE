import { notFound } from "next/navigation";

type TimelineEvent = {
  title: string;
  subtitle: string;
  timeLabel: string;
  active: boolean;
};

type PublicOrderTrackingResponse = {
  token: string;
  orderNumber?: string;
  order_number?: string;
  status?: string;
  trackerStatus?: string;
  tracker_status?: string;
  orderDate?: string;
  order_date?: string;
  customerEmail?: string;
  customer_email?: string;
  address?: Record<string, unknown> | string;
  destinationAddress?: string;
  destination_address?: string;
  shipment?: Record<string, unknown>;
  timeline?: unknown[];
  lastUpdatedAt?: string;
  last_updated_at?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const asString = (value: unknown, fallback = ""): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
};

function getApiBase() {
  return (process.env.NEXT_PUBLIC_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:3001")
    .replace(/\/+$/, "")
    .replace(/\/api$/i, "");
}

function formatDateTime(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const statusPill = (status: string) => {
  const normalized = status.trim().toLowerCase();
  if (normalized === "paid") return "bg-emerald-500/15 text-emerald-300 ring-emerald-500/25";
  if (normalized === "delivered") return "bg-emerald-500/15 text-emerald-300 ring-emerald-500/25";
  if (normalized === "shipped") return "bg-sky-500/15 text-sky-200 ring-sky-500/25";
  if (normalized === "cancelled" || normalized === "canceled")
    return "bg-rose-500/15 text-rose-200 ring-rose-500/25";
  return "bg-amber-500/15 text-amber-200 ring-amber-500/25";
};

function buildAddressLabel(payload: PublicOrderTrackingResponse) {
  const direct =
    asString(payload.destinationAddress ?? payload.destination_address ?? "") ||
    (typeof payload.address === "string" ? payload.address : "");
  if (direct.trim()) return direct.trim();

  const address = isRecord(payload.address) ? payload.address : null;
  if (!address) return "—";

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

  return parts.length > 0 ? parts.join(", ") : "—";
}

function buildFallbackTimeline(status: string, updatedAt?: string): TimelineEvent[] {
  const normalized = status.trim().toLowerCase();
  const steps = [
    { key: "placed", title: "Order placed", subtitle: "We’ve received your order." },
    { key: "paid", title: "Payment confirmed", subtitle: "Payment has been received." },
    { key: "shipped", title: "Order shipped", subtitle: "Your order is on the way." },
    { key: "delivered", title: "Delivered", subtitle: "Your order has arrived." },
  ] as const;

  const activeIndex =
    normalized === "delivered"
      ? 3
      : normalized === "shipped"
        ? 2
        : normalized === "paid"
          ? 1
          : normalized === "cancelled" || normalized === "canceled"
            ? 1
            : 0;

  const timeLabel = updatedAt ? formatDateTime(updatedAt) : "—";
  const events = steps.map((step, index) => ({
    title: step.title,
    subtitle: step.subtitle,
    timeLabel: index === activeIndex ? timeLabel : "—",
    active: index <= activeIndex,
  }));

  if (normalized === "cancelled" || normalized === "canceled") {
    return [
      ...events.slice(0, 2),
      { title: "Cancelled", subtitle: "This order was cancelled.", timeLabel, active: true },
    ];
  }

  return events;
}

export default async function TrackOrderPage({
  params,
}: {
  // Next.js versions differ on whether `params` is sync or async.
  // `await` works for both (awaiting a non-Promise returns the value).
  params: Promise<{ token: string }> | { token: string };
}) {
  const { token } = await params;
  if (!token) notFound();
  const apiBase = getApiBase();

  const fetchUrl = `${apiBase}/api/public/orders/track/${encodeURIComponent(token)}`;
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.info(`[track-order] GET ${fetchUrl}`);
  }

  const res = await fetch(fetchUrl, { cache: "no-store", credentials: "omit" });

  if (res.status === 404) {
    if (process.env.NODE_ENV === "production") notFound();

    return (
      <main className="min-h-screen bg-[#050505] text-white">
        <div className="mx-auto max-w-3xl px-5 py-10">
          <div className="rounded-[28px] border border-[#2f2a16] bg-[#0b0b0a] px-6 py-8 shadow-2xl">
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-[#f1d04b]">
              KATSEYE
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight">
              Tracking link not found (dev)
            </h1>
            <p className="mt-3 text-sm text-[#c7ba81]">
              The backend returned <span className="font-semibold">404</span>{" "}
              for this token.
            </p>

            <div className="mt-6 rounded-2xl border border-[#2f2a16] bg-[#090909] px-4 py-4 text-sm text-[#c7ba81]">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c7ba81]">
                Fetched URL
              </p>
              <p className="mt-2 break-all font-semibold text-white">
                {fetchUrl}
              </p>
              <p className="mt-3 text-sm text-[#c7ba81]">
                Fix: generate/store an order token and implement{" "}
                <span className="font-semibold text-[#f1d04b]">
                  GET /api/public/orders/track/:token
                </span>
                .
              </p>
            </div>
          </div>
        </div>
      </main>
    );
  }
  if (!res.ok) {
    const message = (await res.text().catch(() => "")).trim();
    const suffix =
      process.env.NODE_ENV === "production" ? "" : ` (GET ${fetchUrl})`;
    throw new Error(
      `${message || `Tracking fetch failed: HTTP_${res.status}`}${suffix}`,
    );
  }

  const data = (await res.json()) as PublicOrderTrackingResponse;

  const orderNumber = asString(data.orderNumber ?? data.order_number ?? "", "—");
  const status = asString(data.trackerStatus ?? data.tracker_status ?? data.status ?? "pending");
  const orderDate = asString(data.orderDate ?? data.order_date ?? "");
  const customerEmail = asString(data.customerEmail ?? data.customer_email ?? "");
  const addressLabel = buildAddressLabel(data);
  const lastUpdatedAt = asString(data.lastUpdatedAt ?? data.last_updated_at ?? "");

  const shipment = isRecord(data.shipment) ? data.shipment : null;
  const carrier = asString(shipment?.carrier ?? shipment?.shipping_carrier ?? "");
  const trackingNumber = asString(
    shipment?.trackingNumber ?? shipment?.tracking_number ?? shipment?.tracking_no ?? "",
  );

  const timeline = (() => {
    if (Array.isArray(data.timeline) && data.timeline.length > 0) {
      return data.timeline
        .map((event) => (isRecord(event) ? event : null))
        .filter((event): event is Record<string, unknown> => event !== null)
        .slice(0, 8)
        .map((event) => ({
          title: asString(event.title ?? event.label ?? "Update"),
          subtitle: asString(event.subtitle ?? event.description ?? ""),
          timeLabel: formatDateTime(asString(event.time ?? event.timestamp ?? "")),
          active: Boolean(event.active ?? true),
        }));
    }

    return buildFallbackTimeline(status, lastUpdatedAt || orderDate);
  })();

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="mx-auto max-w-3xl px-5 py-10">
        <header className="rounded-[28px] border border-[#2f2a16] bg-[#0b0b0a] px-6 py-6 shadow-2xl">
          <div className="text-xs font-semibold uppercase tracking-[0.28em] text-[#f1d04b]">
            KATSEYE
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">
            Track Order
          </h1>
          <p className="mt-2 text-sm text-[#c7ba81]">
            This tracking page is public, so you can open it without logging in.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-[#2f2a16] bg-[#090909] px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c7ba81]">
                Order
              </p>
              <p className="mt-2 text-2xl font-semibold">{orderNumber}</p>
              {orderDate ? (
                <p className="mt-1 text-xs text-[#8e7727]">
                  {formatDateTime(orderDate)}
                </p>
              ) : null}
            </div>

            <div className="rounded-2xl border border-[#2f2a16] bg-[#090909] px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c7ba81]">
                Status
              </p>
              <div className="mt-2 inline-flex items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] ring-1 ${statusPill(
                    status,
                  )}`}
                >
                  {status}
                </span>
              </div>
              {customerEmail ? (
                <p className="mt-2 text-xs text-[#8e7727] break-all">
                  {customerEmail}
                </p>
              ) : null}
            </div>
          </div>
        </header>

        <section className="mt-6 grid gap-4">
          <article className="rounded-[28px] border border-[#2f2a16] bg-[#0b0b0a] px-6 py-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Tracking Timeline</h2>
              <p className="text-xs text-[#8e7727]">
                Updated {formatDateTime(lastUpdatedAt || orderDate)}
              </p>
            </div>

            <ol className="mt-5 space-y-4">
              {timeline.map((event, index) => (
                <li key={`${event.title}-${index}`} className="flex gap-4">
                  <div className="mt-1 flex flex-col items-center">
                    <span
                      className={`grid h-9 w-9 place-items-center rounded-2xl ring-1 ring-inset ${
                        event.active
                          ? "bg-[#f1d04b] text-[#090909] ring-[#f1d04b]/30"
                          : "bg-[#11110f] text-[#8e7727] ring-[#2f2a16]"
                      }`}
                    >
                      {event.active ? "✓" : "•"}
                    </span>
                    {index === timeline.length - 1 ? null : (
                      <span className="mt-2 h-6 w-px bg-[#2f2a16]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{event.title}</p>
                      <p className="text-xs text-[#8e7727]">{event.timeLabel}</p>
                    </div>
                    {event.subtitle ? (
                      <p className="mt-1 text-sm text-[#c7ba81]">
                        {event.subtitle}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </article>

          <article className="rounded-[28px] border border-[#2f2a16] bg-[#0b0b0a] px-6 py-6">
            <h2 className="text-lg font-semibold">Delivery Address</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-[#c7ba81]">
              {addressLabel}
            </p>
          </article>

          <article className="rounded-[28px] border border-[#2f2a16] bg-[#0b0b0a] px-6 py-6">
            <h2 className="text-lg font-semibold">Shipment</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-[#2f2a16] bg-[#090909] px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c7ba81]">
                  Carrier
                </p>
                <p className="mt-2 text-sm font-semibold">
                  {carrier || "—"}
                </p>
              </div>
              <div className="rounded-2xl border border-[#2f2a16] bg-[#090909] px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c7ba81]">
                  Tracking number
                </p>
                <p className="mt-2 break-all text-sm font-semibold">
                  {trackingNumber || "—"}
                </p>
              </div>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
