# Architecture and current coverage

## Deployment boundary

Exactly two deployable applications live under `apps/`. The frontend owns all public, account and admin pages. The API owns authentication, authorization, database access, inventory, commerce and integrations. Shared packages contain browser-safe contracts/components, never credentials or database models. There is no separate admin app and no business logic in Next.js API handlers.

Express `app.ts` composes middleware/routes. Local `server.ts` listens on port 5000; the Vercel entry exports the app. Connection promises are cached for warm function invocations. Request parsing and validation precede business services. Models/repositories own persistence. Staff endpoints validate both roles and allowed fields. Customer queries filter by the authenticated owner.

The frontend uses explicit Next.js routes, feature components and data hooks. Account and admin have their own layouts. Search navigation refreshes results. API errors have stable codes and request IDs. Loading/error/empty states are distinct. Shared Zod contracts reject malformed carts and admin input.

## Existing data

The refactor preserves collection names and existing records. Previous source snapshots are in ignored `.local/refactor-backup/`. Customer requests/content/settings still use the existing Entity collection behind a dedicated repository and validation layer. Moving those records to separate collections requires an explicit migration with reconciliation; it was not performed implicitly during this cleanup.

MongoDB transactions protect reservations, stock adjustments, payment capture and cancellation. Prices/tax totals are server-calculated in paise. Stock commits once at verified capture. Idempotency keys prevent repeated checkout/adjustment requests from repeating mutations. Shipping status changes do not commit inventory again.

## Routes

- Public: `/`, `/spare-parts`, `/spare-parts/[category]`, `/search`, `/product/[slug]`, `/machines`, `/machines/[slug]`, `/machines/category/[category]`, `/services`, `/services/[slug]`, `/find-my-spare`, `/bulk-quote`, `/contact`, `/about`, `/faq`, `/resources/[slug]`, `/policies/[slug]`.
- Customer: `/cart`, `/checkout`, `/order/success/[orderNo]`, `/track/[orderNo]`, `/account` and profile/company/orders/addresses/enquiries/quotes/service-requests/find-my-spare/saved/notifications.
- Staff: `/admin` and the module routes documented in ADMIN.md.
- Business API: `/api/v1/*` in the Express app only.

`/machines/category/[category]` avoids conflicting sibling dynamic routes. Existing order links use the database ID in the order-reference route segment.

## Production controls

- HttpOnly opaque sessions, bcrypt hashes, server-side role checks and session revocation after staff access changes.
- Exact origin checks for browser writes, security headers, request-size limits and database-backed rate limiting.
- Validated environment configuration. Vercel rejects localhost MongoDB, local persistent uploads and simulated payment mode.
- Sample catalogue entries cannot be sold in production. Production checkout defaults off. Missing shipping configuration fails instead of inventing a real quote.
- S3 and local storage adapters; admin product uploads validate file size, MIME and image signatures. SVG uploads are not accepted.
- Razorpay verification and durable webhook event records. Authentication keys stay server-side. Duplicate webhook/browser confirmations are safe.
- Bounded reservation maintenance and tracking reconciliation endpoints protected by a scheduler secret. No in-process timer is used for correctness.

## Coverage and remaining release work

The modular refactor, admin operations panel and Razorpay test integration are implemented. See ADMIN.md for exact supported actions and RAZORPAY.md for payment verification.

Orders, Shiprocket shipping, webhook tracking, NDR/RTO, returns and Razorpay refunds are implemented; see FULFILMENT.md.

Before live commerce: validate Shiprocket with real credentials and one live parcel; configure public Razorpay and Shiprocket webhooks and complete a captured test payment and refund; approve catalogue prices, tax and policies; configure S3, production indexes, monitoring and backup/restore; add handling for provider orders left ambiguous by a process failure. Provider-initiated unpaid orders stay reserved for reconciliation/review rather than being automatically cancelled.

Other document requirements remain separate product work: password recovery/email verification, persistent cart merge across devices, private request attachments, automated quote conversion, invoices, technician visit reports, notification delivery/outbox and advanced reports. Current public catalogue browsing uses the initial catalogue snapshot; scaling beyond that snapshot requires completing server-paginated storefront browsing. These are not described as production-complete features.
