# Orders, shipping and tracking

Paid orders move from packing to delivery through Shiprocket. Courier progress comes from Shiprocket webhooks, with a scheduled sync as a backstop, never from manual status edits. Returns, RTO, cancellations and Razorpay refunds use the same audited services. The generic admin PATCH for orders, payments and shipments answers `409 USE_ORDER_ACTIONS`.

## Status model

Four independent statuses, each owned by one part of the system:

| Status     | Values                                                                                                                                                                                                                                        | Changed by                                       |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Order      | PENDING_PAYMENT, PAID, CONFIRMED, PROCESSING, PACKED, SHIPPED, DELIVERED, CANCELLED, RETURN_REQUESTED, RETURNED, REFUND_PENDING, PARTIALLY_REFUNDED, REFUNDED                                                                                 | Payment capture, staff actions, courier tracking |
| Payment    | CREATED, PENDING, AUTHORIZED, CAPTURED, FAILED, REFUND_PENDING, PARTIALLY_REFUNDED, REFUNDED                                                                                                                                                  | Razorpay verification and webhooks only          |
| Fulfilment | UNFULFILLED, PICKING, PACKED, READY_TO_SHIP, SHIPPED, DELIVERED, RETURNED                                                                                                                                                                     | Staff actions and tracking                       |
| Shipment   | NOT_CREATED, CREATED, COURIER_ASSIGNED, AWB_GENERATED, LABEL_GENERATED, LABEL_PRINTED, PICKUP_SCHEDULED, PICKED_UP, IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED, DELIVERY_EXCEPTION, NDR, RTO_INITIATED, RTO_IN_TRANSIT, RTO_DELIVERED, CANCELLED | Shiprocket responses and tracking                |

Rules:

- An order becomes SHIPPED only when the courier scans the parcel as picked up. A label, an AWB or a scheduled pickup is not enough.
- Tracking moves forward only. A late or out-of-order scan is stored as an event but cannot move a shipment back, for example from DELIVERED to IN_TRANSIT.
- Each order has at most one active shipment, enforced by a unique index. Provider calls run under a short lease, so double clicks and concurrent requests cannot book twice.
- When a provider call fails, the shipment keeps `lastError` (the step, message and time). The admin order page shows it with a Retry button. A successful retry clears it.

## Operations flow (Admin → Orders → open an order)

The order page shows one primary action for the current state.

1. **Start Processing**: PAID/CONFIRMED to PROCESSING.
2. **Mark Packed**: requires weight (kg), dimensions (cm) and package count. A shipment record is created so the order appears in Shipments → Ready to Ship. Product weight and dimensions (product form → Shipping tab) feed delivery rates at checkout; `DEFAULT_ITEM_WEIGHT_KG` is used when a product has none.
3. **Create Shipment**: creates the Shiprocket order. This is idempotent: repeating it reuses the existing provider order.
4. **Choose Courier**: lists serviceable couriers with rate and ETA. Pick one, or choose **Use Recommended** to take Shiprocket's choice. The AWB is stored and shown to the customer.
5. **Generate Label**, then **Print Label**: every print and reprint is recorded with time and staff member (LABEL_PRINT/LABEL_REPRINT audit).
6. **Schedule Pickup**: the order stays PACKED until the courier picks the parcel up.
7. Tracking then arrives by webhook: picked up, in transit, out for delivery, delivered. The customer is notified once per milestone.

Exceptions:

- **Cancel shipment** is allowed only before pickup. It cancels at Shiprocket and leaves a fresh shipment record to rebook.
- **NDR** (failed delivery attempt): record the action taken (contacted customer, updated instructions, retry requested, escalated). Actions are stored and audited on the order; they are not sent to Shiprocket.
- **RTO**: when the parcel is back at the warehouse, inspect it. The goods outcome is Restock (stock returns with a RETURN_RECEIVED ledger entry), Damaged, Reship (back to PACKED with a new shipment) or No action. A refund is optional, except with Reship. RTO never restocks automatically.
- **Cancel order** after payment: cancels the shipment if not yet picked up, restocks, sets CANCELLED and refunds the captured payment through Razorpay.
- **Returns**: customers request a return from a delivered order (items, reason, comments). Staff approve or reject, record what was received (restock or write off damaged items), then refund.
- **Refunds**: full or partial, never more than the refundable balance, each with an idempotency key. The final status comes from Razorpay `refund.processed` / `refund.failed` webhooks. Use **Check status** to re-check a pending refund.

Permissions:

- `orders`: view and work orders.
- `shipments` in addition: all fulfilment actions.
- `payments`: refunds and paid cancellations (ADMIN and SUPER_ADMIN only).

Sales staff can view orders but cannot ship or refund. Every action writes an audit entry with before/after values, actor and request ID, and the order timeline shows the actor's name.

Admin → Shipments views: Ready to Ship, Created, AWB Generated, Label Ready, Label Printed, Pickup Pending, Pickup Scheduled, Shipped, In Transit, Out for Delivery, Delivered, Exceptions, NDR/RTO and Cancelled. Search matches order number, AWB, customer name and phone, courier and Shiprocket IDs. Orders can also be found by email or payment ID. The dashboard's Fulfilment grid links to each queue.

## Customer experience

- Checkout shows Standard and Express delivery options with Shiprocket rates once a valid PIN code is entered. The price is recalculated on the server when the order is placed.
- `/order/success/<id>` confirms the order. `/track/<order number>` and My Orders show stage progress, courier, AWB, expected delivery, the latest scan and the event history.
- Internal provider codes, staff notes and audit data are never sent to customers.
- The invoice button prints the order summary. It is not a GST tax invoice.

## Configuration

Backend environment (see `apps/api/.env.example`):

```dotenv
SHIPPING_PROVIDER=shiprocket          # development | shiprocket | disabled
SHIPROCKET_EMAIL=<API user email>     # Shiprocket → Settings → API → Configure
SHIPROCKET_PASSWORD=<API user password>
SHIPROCKET_PICKUP_LOCATION=<pickup location name exactly as in Shiprocket>
SHIPROCKET_PICKUP_PINCODE=<PIN code of that pickup location>
SHIPROCKET_WEBHOOK_TOKEN=<random secret>
DEFAULT_ITEM_WEIGHT_KG=1
CRON_SECRET=<random secret>           # protects /api/v1/jobs/*
```

- Use a dedicated Shiprocket **API user**, not the account owner's login. The API token is cached and refreshed automatically.
- In production `SHIPPING_PROVIDER` defaults to `disabled`, and `development` is rejected at startup. The development provider is a local stand-in: it returns fixed Standard ₹120 and Express ₹240 rates, generates AWBs and a printable test label, and never invents tracking.

Shiprocket webhook (Settings → API → Webhooks):

- URL: `https://<api-domain>/api/v1/webhooks/courier-updates`. Shiprocket rejects URLs containing "shiprocket"; `/api/v1/webhooks/shiprocket` is the same endpoint for other uses.
- Token: the value of `SHIPROCKET_WEBHOOK_TOKEN`. Shiprocket sends it as the `x-api-key` header, and the API compares it in constant time.
- Duplicate deliveries are ignored by content fingerprint. Unknown AWBs are acknowledged with 200 so Shiprocket does not disable the hook.

Razorpay webhook (`/api/v1/webhooks/razorpay`), subscribed events: `payment.captured`, `order.paid`, `payment.failed`, `refund.processed`, `refund.failed`.

Scheduled jobs (`Authorization: Bearer <CRON_SECRET>`, GET or POST):

- `/api/v1/jobs/reservations`: every minute to every few minutes. Expires unpaid reservations.
- `/api/v1/jobs/tracking`: every 15–30 minutes. Polls up to 25 active shipments that have had no update for 3 hours, through the same deduplicated pipeline. Delivered, RTO-delivered and cancelled shipments are never polled.
- A long-running API server (`npm run dev`, or a VM) runs both on internal timers. Vercel needs Vercel Cron or an external scheduler.

After deploying this version, run once against each database:

```powershell
npm run db:indexes              # shipment, refund, return, webhook and notification indexes
npm run db:migrate-fulfilment   # gives existing orders a fulfilment status; safe to re-run
```

## Verification

`npm run check:fulfilment` runs the whole lifecycle against a temporary database, with Shiprocket and Razorpay mocked at the network boundary. The API, services and MongoDB transactions are real. It covers:

- delivery options, payment failure and duplicate capture, packing validation, and RBAC;
- shipment, label and pickup failures with retry;
- courier choice, label print/reprint audit, and no SHIPPED before pickup;
- webhook auth, deduplication and forward-only tracking, plus customer privacy;
- delivery notifications sent exactly once;
- returns with restock and refund webhooks, NDR, and RTO inspection;
- paid cancellation with refund, manual and scheduled tracking sync, and dashboard counts.

A browser run of the same flow through the real admin and customer screens (dev providers) also passed.

## Before go-live

Not yet verified against live services:

- No Shiprocket credentials have been used yet. Before launch, book, label, schedule pickup for and track one real parcel end to end, and confirm a webhook arrives at the public URL.
- Complete one Razorpay test refund and confirm the `refund.processed` webhook.

Not built (out of scope for this release):

- Notifications are in-app only. No email, SMS or WhatsApp provider is connected.
- No reverse-pickup booking for returns: customers send items back by arrangement.
- No return photos, and no return window yet; set one in the returns policy before launch.
- One shipment per order: no split shipments or multi-box AWBs. Package count is recorded for the label.
- NDR actions are recorded internally, not pushed to Shiprocket's NDR API.
- No GST tax-invoice numbering or seller GSTIN on the printed invoice.
