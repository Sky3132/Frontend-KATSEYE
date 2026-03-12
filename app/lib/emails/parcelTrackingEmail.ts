type ParcelTrackingEmailInput = {
  productName: string;
  customerEmail: string;
  trackingUrl: string;
  orderId?: string;
};

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

export function buildParcelTrackingEmail(input: ParcelTrackingEmailInput) {
  const productName = escapeHtml(input.productName);
  const trackingUrl = input.trackingUrl;
  const orderId = input.orderId ? escapeHtml(input.orderId) : null;

  const subject = `Your ${input.productName} order is confirmed`;

  const text = [
    "Thank you for your purchase.",
    "Click the link below to track your parcel:",
    trackingUrl,
    orderId ? `Order ID: ${input.orderId}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const html = `<!doctype html>
<html>
  <body style="margin:0;background:#0b0b0f;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#ffffff;">
    <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
      <div style="background:#11111a;border:1px solid rgba(255,255,255,0.12);border-radius:16px;padding:22px;">
        <h1 style="margin:0 0 8px 0;font-size:20px;line-height:1.3;">Thank you for your purchase</h1>
        <p style="margin:0 0 16px 0;color:rgba(255,255,255,0.75);font-size:14px;line-height:1.55;">
          Your order for <strong style="color:#fff;">${productName}</strong> is confirmed.
        </p>
        <p style="margin:0 0 16px 0;color:rgba(255,255,255,0.75);font-size:14px;line-height:1.55;">
          Click the button below to track your parcel:
        </p>
        <div style="margin:18px 0 18px 0;">
          <a href="${trackingUrl}" target="_blank" rel="noreferrer"
            style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 16px;border-radius:999px;font-weight:600;font-size:14px;">
            Track your parcel
          </a>
        </div>
        <p style="margin:0;color:rgba(255,255,255,0.75);font-size:12px;line-height:1.55;">
          If the button doesn't work, open this link:<br/>
          <a href="${trackingUrl}" style="color:#93c5fd;word-break:break-all;">${trackingUrl}</a>
        </p>
        ${
          orderId
            ? `<p style="margin:16px 0 0 0;color:rgba(255,255,255,0.75);font-size:12px;">Order ID: ${orderId}</p>`
            : ""
        }
        <p style="margin:16px 0 0 0;color:rgba(255,255,255,0.55);font-size:12px;">
          This email was sent to ${escapeHtml(input.customerEmail)}.
        </p>
      </div>
    </div>
  </body>
</html>`;

  return { subject, text, html };
}

