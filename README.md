This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Public Tracking (no login)

This repo includes public tracking pages that are intentionally **not** behind auth middleware, so customers can open them from an email link without logging in:

- Order tracking: `GET /track-order/:token` (example: `/track-order/abC123...`)
- Parcel tracking: `GET /track/:token` (example: `/track/abC123...`)

### Configure API base

Set the backend base URL (no trailing `/api`) via:

- `NEXT_PUBLIC_API_BASE_URL=http://localhost:3001`

### Email sending

The backend sends the designed "Thank you for your purchase" email when an order is marked **paid** (admin action).

Email template references (frontend):

- `app/lib/emails/purchaseThankYouEmail.ts`
- `app/lib/emails/parcelTrackingEmail.ts`

Backend requirements (for local dev):

- Backend running (API on `http://localhost:3001/api`).
- CORS allowed: backend `.env` `FRONTEND_ORIGIN` must match your frontend dev URL (example: `http://localhost:3000`).

Flow:

- Checkout creates an order (typically `pending`).
- Admin marks it paid: `PATCH /api/admin/orders/:id/status` with `{ "status": "paid" }`.
- Backend sends the thank-you email (black/yellow theme) with a "Track my order" button linking to `/track-order/:token`.

## Backend endpoint contracts (required)

The public tracking pages call the backend (no cookies required):

- Order tracking page: `GET {API_BASE}/api/public/orders/track/:token`
- Parcel tracking page: `GET {API_BASE}/api/public/parcels/track/:token`

### Order tracking response (example)

Return JSON similar to:

```json
{
  "token": "abC123",
  "order_number": "ORD-10001",
  "tracker_status": "shipped",
  "status": "paid",
  "order_date": "2026-03-11T10:30:00.000Z",
  "customer_email": "customer@example.com",
  "address": {
    "line1": "123 Main St",
    "city": "City",
    "country": "Country"
  },
  "shipment": {
    "carrier": "DHL",
    "tracking_number": "DHL-AB12CD34EF56"
  },
  "timeline": [
    { "title": "Order placed", "timestamp": "2026-03-11T10:30:00.000Z", "active": true },
    { "title": "Payment confirmed", "timestamp": "2026-03-11T10:35:00.000Z", "active": true },
    { "title": "Order shipped", "timestamp": "2026-03-12T08:00:00.000Z", "active": true }
  ],
  "last_updated_at": "2026-03-12T08:00:00.000Z"
}
```

Notes:

- The response can be snake_case or camelCase; the page normalizes both.
- If you don’t have a timeline yet, omit `timeline` and the page will show a fallback timeline from the current status.

### Parcel tracking response (example)

Return JSON similar to:

```json
{
  "token": "abC123",
  "status": "In transit",
  "estimatedArrivalDate": "2026-03-20T00:00:00.000Z",
  "carrier": "DHL",
  "trackingNumber": "1234567890",
  "customerEmail": "customer@example.com",
  "destinationAddress": "123 Main St, City, Country",
  "destinationLat": 14.5995,
  "destinationLng": 120.9842,
  "lastUpdatedAt": "2026-03-11T10:30:00.000Z"
}
```

Notes:

- If you omit `destinationLat`/`destinationLng`, the parcel page still works, but the map shows a placeholder.

### Backend implementation notes

- Generate and store an unguessable public token per order (e.g., `public_tracking_token`) and return it in your payment/confirmation flow so the email can link to `{SITE_URL}/track-order/{token}`.
- When admin sets status to `shipped`, generate and persist `shipment.carrier` and `shipment.tracking_number` for that order if missing. These fields are displayed on `/track-order/:token` and will later support “search by tracking number” UI.
- If you add “search by tracking number” later, require an additional secret (e.g., email) or another token to avoid enumeration.

Suggested env for the backend:

- `SITE_URL=https://katseye.world` (or your deployed frontend URL)

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

