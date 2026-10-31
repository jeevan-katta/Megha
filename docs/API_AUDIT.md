# API audit

Audit date: 9 October 2026. Companion to [END_TO_END_APPLICATION_AUDIT.md](END_TO_END_APPLICATION_AUDIT.md).

The API base is `/api/v1`. The API ran locally on a copy of the database, and every call below was made for real; none were simulated. Timings are local, five samples per endpoint. "Server" is the time the API reports in its `Server-Timing` header.

## Summary

- **Fast.** Every measured endpoint has a median of 7–26 ms. The slowest is the dashboard, at 26 ms. No large payloads: the biggest is the public catalogue at 11.8 KB for 12 products.
- **Consistent errors.** Every error returns `{ error: { code, message, requestId } }`, and validation errors add a `fieldErrors` list. 404, 400, 401, 403, 409 and 413 are all used correctly.
- **Correct permissions.** All 152 combinations of 7 roles plus anonymous × 19 admin sections matched the permission table, and 17 targeted checks passed (below).
- **Good security basics.**
  - Response headers: CSP, HSTS, `nosniff` and frame protection are set, and `X-Powered-By` is hidden.
  - Request checks: cross-site and foreign-origin writes are rejected, there is a 1 MB body limit, and image uploads are checked by their real file signature.
  - Webhooks: both need their token or signature.
- **Main API issues:** guest `/me` returns 401 (API-01), the public catalogue exposes internal stock fields (API-02), response shapes are inconsistent (API-03), and the per-IP rate limits are tight (API-04).

## Endpoint timings

| Endpoint                           | Status | Median (ms) | Max (ms) | Size    | Server (ms) |
| ---------------------------------- | ------ | ----------- | -------- | ------- | ----------- |
| `GET /health`                      | 200    | 7           | 21       | 45 B    | 4.8         |
| `GET /config`                      | 200    | 9           | 10       | 104 B   | 5.6         |
| `GET /catalogue`                   | 200    | 10          | 10       | 11.8 KB | 6.5         |
| `GET /products`                    | 200    | 8           | 12       | 7.3 KB  | 6.7         |
| `GET /products?q=pump`             | 200    | 8           | 9        | 656 B   | 7.0         |
| `GET /products/:slug`              | 200    | 9           | 9        | 665 B   | 6.1         |
| `GET /me`                          | 200    | 11          | 12       | 137 B   | 9.4         |
| `GET /me/orders`                   | 200    | 14          | 15       | 3.5 KB  | 11.3        |
| `GET /me/records/enquiries`        | 200    | 11          | 12       | 11 B    | 9.2         |
| `GET /orders/:id`                  | 200    | 17          | 18       | 1.4 KB  | 15.3        |
| `GET /orders/track/:number`        | 200    | 15          | 19       | 1.4 KB  | 11.0        |
| `GET /admin/reports?range=30d`     | 200    | 26          | 29       | 5.9 KB  | 23.1        |
| `GET /admin/orders`                | 200    | 12          | 14       | 7.4 KB  | 10.4        |
| `GET /admin/products`              | 200    | 11          | 16       | 7.3 KB  | 8.2         |
| `GET /admin/inventory`             | 200    | 12          | 17       | 7.3 KB  | 8.3         |
| `GET /admin/shipments`             | 200    | 11          | 12       | 50 B    | 9.5         |
| `GET /admin/shipments/summary`     | 200    | 16          | 16       | 808 B   | 13.8        |
| `GET /admin/customers`             | 200    | 11          | 17       | 1.0 KB  | 15.3        |
| `GET /admin/enquiries`             | 200    | 11          | 14       | 845 B   | 8.9         |
| `GET /admin/audit`                 | 200    | 11          | 12       | 1.2 KB  | 7.6         |
| `GET /admin/lookups`               | 200    | 12          | 14       | 1.8 KB  | 12.4        |
| `GET /admin/orders/:id/details`    | 200    | 15          | 21       | 1.7 KB  | 13.9        |
| `GET /admin/inventory/:id/history` | 200    | 11          | 12       | 3.4 KB  | 8.5         |

The only slow call seen was the very first `/catalogue` request after the API started, at 1.0 s; every later call took about 10 ms. Customer checkout calls (`/checkout/validate`, `/checkout/shipping-rates`, `/orders`, `/payments/*`) responded within the browser timings in [TESTED_ROUTES.md](TESTED_ROUTES.md); none was slow.

## Validation and error handling (all passed)

| Request                                                         | Result                                                   |
| --------------------------------------------------------------- | -------------------------------------------------------- |
| Unknown route                                                   | 404 "Endpoint not found."                                |
| Unknown product slug                                            | 404 "Product not found."                                 |
| Invalid id (`/orders/not-an-id`)                                | 400 "Invalid record identifier"                          |
| Malformed JSON                                                  | 400 "Invalid request data."                              |
| 2 MB body                                                       | 413 "Request exceeds the allowed size."                  |
| Cart quantity 1000                                              | 400. The field error says the maximum is 100.            |
| Cart with an unknown product                                    | 400 "A selected part is no longer available."            |
| Bad PIN code                                                    | 400 `pincode: Invalid`                                   |
| Weak password on register                                       | 400. The field error gives the minimum of 10 characters. |
| Wrong password                                                  | 401 "Email or password is incorrect."                    |
| Duplicate registration                                          | 409 "An account already exists for that email."          |
| Public form missing fields                                      | 400 with a per-field list                                |
| Unknown request kind, or a customer reading `/me/records/users` | 400                                                      |
| Another customer's order, by id or by number                    | 404 (no information leaked)                              |
| Admin list `limit=5000`                                         | 400 (maximum 100)                                        |
| Customer cancels a paid order                                   | 409 "Paid orders require an admin refund review."        |
| Return on an undelivered order                                  | 409 "Returns can be requested after delivery."           |
| Generic `PATCH` setting an order status                         | 409 "Use the order actions to update this order."        |
| Courier webhook without its token                               | 401                                                      |
| Courier webhook for an unknown AWB, with the token              | 200 (acknowledged, ignored)                              |
| Razorpay webhook without a signature                            | 401                                                      |
| Scheduler job without the secret                                | 401                                                      |
| Cross-site POST (`Sec-Fetch-Site: cross-site`)                  | 403                                                      |
| POST from a foreign `Origin`                                    | 403                                                      |
| Media upload: SVG, a text file named `.png`, a 5 MB file        | 400, with a clear message each time                      |

## Permission checks (all passed)

- Sales cannot create products, adjust stock or pack orders.
- Inventory Manager cannot read payments or issue refunds.
- A customer cannot read admin lookups or upload media.
- Admin cannot create a Super Admin. Super Admin cannot remove their own access.
- A technician sees only their assigned job, cannot update other jobs and cannot reassign jobs.

A separate check confirmed that password hashes are never returned. The `password` field is excluded by the database model.

## Issues

| ID     | Priority | Endpoint                               | Problem                                                                                                                                                                                                                                                                                 | Recommendation                                                                                                                     |
| ------ | -------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| API-01 | P3       | `GET /me`                              | A guest gets 401, which logs a red console error on every public page load.                                                                                                                                                                                                             | Return `200 { data: null }` for guests. Keep 401 for protected routes.                                                             |
| API-02 | P3       | `GET /catalogue`, `GET /products`      | The public product objects include `stock`, `reserved`, `threshold`, `developmentOnly`, `__v`, `createdAt` and `updatedAt`. Exact stock levels are visible to anyone.                                                                                                                   | Return a public shape: name, price, image, specifications and an availability flag (in stock / low / out).                         |
| API-03 | P3       | `GET /products`, `GET /products/:slug` | Shapes are inconsistent: the list returns `{ data, meta }`, and the detail nests `data.product` and `data.compatibility`, while other endpoints return `data` directly.                                                                                                                 | Pick one shape for lists and one for details.                                                                                      |
| API-04 | P2       | All endpoints, `/auth/*`               | Limits are 300 requests per minute per IP for the whole API, and 30 per 15 minutes for login and register combined. Staff in one office share an IP, and each admin page load makes about 8 calls. During the audit, automated testing from one machine hit this limit within a minute. | Rate-limit per user when signed in, and per IP plus email for login. Raise the general limit, or exclude reads by signed-in staff. |
| API-05 | P3       | `GET /admin/users`                     | Returns customers as well as staff.                                                                                                                                                                                                                                                     | Filter `/admin/users` to staff roles. Customers already have their own section.                                                    |
| API-06 | P3       | `GET /cart`, `PUT /cart`               | Implemented, but the frontend never calls them, because the cart lives in browser storage.                                                                                                                                                                                              | Either use them to keep a signed-in customer's cart across devices, or remove them.                                                |
| API-07 | P3       | `GET /orders/:id` (customer)           | Returns internal fields (`__v`, `paymentProvider`, `reservationExpires`) the page doesn't use.                                                                                                                                                                                          | Trim the customer order view.                                                                                                      |
| API-08 | P3       | Validation messages                    | Field errors use the library's default wording ("Invalid", "String must contain at least 5 character(s)"), and the checkout shows them to customers as they are, e.g. "customer.phone: Invalid".                                                                                        | Add plain messages to the shared schemas, e.g. "Enter a 10-digit mobile number".                                                   |

## Not covered

- **Shiprocket:** no credentials are configured. Shiprocket was tested only through the project's mocked check (`npm run check:fulfilment`, passed) and the development shipping provider.
- **Razorpay:** a real test-mode order was created and the hosted checkout opened, but no card or UPI payment was submitted in a browser. Capture, duplicate callbacks and webhooks are covered by `npm run check:payments`, which uses a mocked Razorpay transport and passed.
- **Not called in this audit:** `POST /newsletter`, `POST /admin/payments/:id/reconcile`, `POST /admin/orders/:id/refunds/:refundId/reconcile`, and the NDR and RTO endpoints. The NDR and RTO endpoints are covered by `npm run check:fulfilment`.
