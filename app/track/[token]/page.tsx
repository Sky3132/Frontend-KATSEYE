import { notFound } from "next/navigation";

type ParcelTrackingResponse = {
  token: string;
  status?: string;
  estimatedArrivalDate?: string; // ISO string
  carrier?: string;
  trackingNumber?: string;
  customerEmail?: string;
  destinationAddress?: string;
  destinationLat?: number;
  destinationLng?: number;
  lastUpdatedAt?: string; // ISO string
};

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "2-digit" }).format(date);
}

function getApiBase() {
  return (process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001")
    .replace(/\/+$/, "")
    .replace(/\/api$/i, "");
}

export default async function TrackParcelPage({
  params,
}: {
  params: { token: string };
}) {
  const { token } = params;

  const apiBase = getApiBase();
  const res = await fetch(`${apiBase}/api/public/parcels/track/${encodeURIComponent(token)}`, {
    cache: "no-store",
  });

  if (res.status === 404) notFound();
  if (!res.ok) {
    throw new Error(`Tracking fetch failed: HTTP_${res.status}`);
  }

  const data = (await res.json()) as ParcelTrackingResponse;

  const hasCoords =
    typeof data.destinationLat === "number" &&
    Number.isFinite(data.destinationLat) &&
    typeof data.destinationLng === "number" &&
    Number.isFinite(data.destinationLng);

  const lat = hasCoords ? data.destinationLat! : 0;
  const lng = hasCoords ? data.destinationLng! : 0;

  const mapSrc = hasCoords
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(
        `${lng - 0.02},${lat - 0.02},${lng + 0.02},${lat + 0.02}`,
      )}&layer=mapnik&marker=${encodeURIComponent(`${lat},${lng}`)}`
    : null;

  return (
    <main className="min-h-screen bg-[#0b0b0f] text-white">
      <div className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="text-2xl font-semibold">Parcel Tracking</h1>
        <p className="mt-2 text-sm text-white/70">
          This tracking page is public, so you can open it without logging in.
        </p>

        <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <div className="text-xs uppercase tracking-wide text-white/60">Status</div>
              <div className="mt-1 text-base">{data.status ?? "—"}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-white/60">Estimated Arrival</div>
              <div className="mt-1 text-base">{formatDate(data.estimatedArrivalDate)}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-white/60">Carrier</div>
              <div className="mt-1 text-base">{data.carrier ?? "—"}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-white/60">Tracking Number</div>
              <div className="mt-1 text-base">{data.trackingNumber ?? "—"}</div>
            </div>
            <div className="sm:col-span-2">
              <div className="text-xs uppercase tracking-wide text-white/60">Customer Email</div>
              <div className="mt-1 break-all text-base">{data.customerEmail ?? "—"}</div>
            </div>
            <div className="sm:col-span-2">
              <div className="text-xs uppercase tracking-wide text-white/60">Destination Address</div>
              <div className="mt-1 whitespace-pre-wrap text-base">{data.destinationAddress ?? "—"}</div>
            </div>
            <div className="sm:col-span-2">
              <div className="text-xs uppercase tracking-wide text-white/60">Last Updated</div>
              <div className="mt-1 text-base">{formatDate(data.lastUpdatedAt)}</div>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">Delivery Map</h2>
            {!mapSrc ? <span className="text-xs text-white/60">No coordinates available</span> : null}
          </div>

          <div className="mt-4 overflow-hidden rounded-lg border border-white/10 bg-black/20">
            {mapSrc ? (
              // OpenStreetMap embed requires no API key. If you want a richer map, swap this with your preferred provider.
              <iframe
                title="Delivery map"
                src={mapSrc}
                className="h-[320px] w-full"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : (
              <div className="flex h-[320px] items-center justify-center text-sm text-white/70">
                Ask the backend to return `destinationLat` and `destinationLng` to enable the map.
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
