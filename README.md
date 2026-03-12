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

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Public Parcel Tracking (no login)

This repo includes a public tracking page at:

- `GET /track/:token` (example: `/track/abC123...`)

It is intentionally **not** behind auth middleware, so customers can open it from an email link without logging in.

### Configure API base

Set the backend base URL (no trailing `/api`) via:

- `NEXT_PUBLIC_API_BASE_URL=http://localhost:3001`

### Email sending

The backend sends the designed â€œThank you for your purchaseâ€ email when an order is marked **paid** (admin action). The frontend should **not** call `/api/mail/test` (itâ€™s removed).

Email HTML template reference (frontend):

- `frontend-katseye/app/lib/emails/purchaseThankYouEmail.ts`
- `frontend-katseye/app/lib/emails/cartReminderEmail.ts`

Backend requirements (for local dev):

- Backend running: `cmd /c npm run start:dev` (API on `http://localhost:3001/api`).
- CORS allowed: backend `.env` `FRONTEND_ORIGIN` must match your frontend dev URL (example: `http://localhost:3000`).

Flow:

- Checkout creates an order (typically `pending`).
- Admin marks it paid: `PATCH /api/admin/orders/:id/status` with `{ "status": "paid" }`.
- Backend sends the thank-you email (black/yellow theme) with a â€œTrack my orderâ€ button.

### Backend endpoint contract (required)

The tracking page calls the backend:

- `GET {API_BASE}/api/public/parcels/track/:token`

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

- If you omit `destinationLat`/`destinationLng`, the page still works, but the map shows a placeholder.
- The endpoint must be public and must not require cookies.

### Email template reference (backend should send the email)

Use `app/lib/emails/parcelTrackingEmail.ts` as the reference template. After a successful payment on the backend:

1. Create a parcel record with a random `token` (store it with the order + customer email).
2. Send the email containing a link to the frontend tracking page: `{SITE_URL}/track/{token}`.

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
