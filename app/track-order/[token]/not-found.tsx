export default function TrackOrderNotFound() {
  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="mx-auto max-w-3xl px-5 py-10">
        <div className="rounded-[28px] border border-[#2f2a16] bg-[#0b0b0a] px-6 py-8 shadow-2xl">
          <div className="text-xs font-semibold uppercase tracking-[0.28em] text-[#f1d04b]">
            KATSEYE
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">
            Tracking link not found
          </h1>
          <p className="mt-3 text-sm text-[#c7ba81]">
            This tracking link is invalid or hasn&apos;t been created on the
            backend yet.
          </p>

          <div className="mt-6 rounded-2xl border border-[#2f2a16] bg-[#090909] px-4 py-4 text-sm text-[#c7ba81]">
            <p className="font-semibold text-white">Backend checklist</p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                Generate and store an unguessable per-order token (example:
                <span className="font-semibold text-[#f1d04b]">
                  {" "}
                  public_tracking_token
                </span>
                ).
              </li>
              <li>
                Send email link as{" "}
                <span className="font-semibold text-[#f1d04b]">
                  /track-order/&lt;token&gt;
                </span>
                .
              </li>
              <li>
                Implement{" "}
                <span className="font-semibold text-[#f1d04b]">
                  GET /api/public/orders/track/:token
                </span>{" "}
                to return the order number, status, address, and shipment.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}

