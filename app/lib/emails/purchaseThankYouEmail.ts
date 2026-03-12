type PurchaseLineItem = {
  name: string;
  quantity: number;
  unitPrice: string;
  lineTotal?: string;
};

type PurchaseThankYouEmailInput = {
  customerEmail: string;
  orderId?: string;
  items: PurchaseLineItem[];
  total: string;
  trackingUrl: string;
};

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

export function buildPurchaseThankYouEmail(input: PurchaseThankYouEmailInput) {
  const subject = "Thank you for your purchase â€” KATSEYE";
  const trackingUrl = input.trackingUrl;
  const orderId = input.orderId ? escapeHtml(input.orderId) : null;
  const total = escapeHtml(input.total);
  const customerEmail = escapeHtml(input.customerEmail);

  const safeItems = input.items.map((item) => ({
    name: escapeHtml(item.name),
    quantity: Number.isFinite(item.quantity) ? Math.max(1, item.quantity) : 1,
    unitPrice: escapeHtml(item.unitPrice),
    lineTotal: escapeHtml(item.lineTotal ?? ""),
  }));

  const text = [
    "Thank you for your purchase.",
    orderId ? `Order ID: ${input.orderId}` : null,
    `Total: ${input.total}`,
    "",
    "Track your order:",
    trackingUrl,
  ]
    .filter(Boolean)
    .join("\n");

  const html = `<!doctype html>
<html>
  <body style="margin:0;background:#050505;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#f0d34f;">
    <div style="max-width:620px;margin:0 auto;padding:36px 18px;">
      <div style="background:#0b0b0a;border:1px solid rgba(240,211,79,0.22);border-radius:18px;overflow:hidden;">
        <div style="padding:22px 22px 16px 22px;background:linear-gradient(90deg,rgba(240,211,79,0.16),rgba(240,211,79,0));border-bottom:1px solid rgba(240,211,79,0.18);">
          <div style="font-size:12px;letter-spacing:0.22em;text-transform:uppercase;font-weight:700;color:rgba(240,211,79,0.85);">
            KATSEYE
          </div>
          <h1 style="margin:10px 0 0 0;font-size:22px;line-height:1.25;color:#f0d34f;">
            Thank you for your purchase
          </h1>
          <p style="margin:10px 0 0 0;font-size:14px;line-height:1.6;color:rgba(240,211,79,0.82);">
            Your order is being prepared. Below is your purchase summary.
          </p>
        </div>

        <div style="padding:18px 22px 8px 22px;">
          ${
            orderId
              ? `<p style="margin:0 0 10px 0;font-size:12px;line-height:1.6;color:rgba(240,211,79,0.7);">Order ID: <strong style="color:#f0d34f;">${orderId}</strong></p>`
              : ""
          }

          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
            <thead>
              <tr>
                <th align="left" style="padding:10px 0;border-bottom:1px solid rgba(240,211,79,0.18);font-size:12px;color:rgba(240,211,79,0.72);font-weight:600;">Item</th>
                <th align="center" style="padding:10px 0;border-bottom:1px solid rgba(240,211,79,0.18);font-size:12px;color:rgba(240,211,79,0.72);font-weight:600;width:64px;">Qty</th>
                <th align="right" style="padding:10px 0;border-bottom:1px solid rgba(240,211,79,0.18);font-size:12px;color:rgba(240,211,79,0.72);font-weight:600;width:110px;">Price</th>
                <th align="right" style="padding:10px 0;border-bottom:1px solid rgba(240,211,79,0.18);font-size:12px;color:rgba(240,211,79,0.72);font-weight:600;width:120px;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${safeItems
                .map(
                  (item) => `<tr>
                <td style="padding:12px 0;border-bottom:1px solid rgba(240,211,79,0.12);font-size:13px;color:rgba(255,255,255,0.92);">${item.name}</td>
                <td align="center" style="padding:12px 0;border-bottom:1px solid rgba(240,211,79,0.12);font-size:13px;color:rgba(255,255,255,0.92);">${item.quantity}</td>
                <td align="right" style="padding:12px 0;border-bottom:1px solid rgba(240,211,79,0.12);font-size:13px;color:rgba(255,255,255,0.92);">${item.unitPrice}</td>
                <td align="right" style="padding:12px 0;border-bottom:1px solid rgba(240,211,79,0.12);font-size:13px;color:rgba(255,255,255,0.92);">${item.lineTotal || "&nbsp;"}</td>
              </tr>`,
                )
                .join("")}
            </tbody>
          </table>

          <div style="margin-top:14px;display:flex;justify-content:space-between;gap:12px;align-items:center;">
            <div style="font-size:12px;color:rgba(240,211,79,0.7);">Total paid</div>
            <div style="font-size:18px;font-weight:800;color:#f0d34f;">${total}</div>
          </div>
        </div>

        <div style="padding:18px 22px 22px 22px;">
          <a href="${trackingUrl}" target="_blank" rel="noreferrer"
            style="display:inline-block;background:#f0d34f;color:#090909;text-decoration:none;padding:12px 16px;border-radius:999px;font-weight:800;font-size:14px;">
            Click here to track your order
          </a>
          <p style="margin:14px 0 0 0;font-size:12px;line-height:1.6;color:rgba(240,211,79,0.72);">
            If the button doesnâ€™t work, open this link:<br/>
            <a href="${trackingUrl}" style="color:#f0d34f;word-break:break-all;">${trackingUrl}</a>
          </p>
          <p style="margin:14px 0 0 0;font-size:12px;line-height:1.6;color:rgba(240,211,79,0.55);">
            This email was sent to ${customerEmail}.
          </p>
        </div>
      </div>
    </div>
  </body>
</html>`;

  return { subject, text, html };
}

