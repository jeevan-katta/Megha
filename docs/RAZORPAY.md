# Razorpay test integration

The browser opens Razorpay Standard Checkout using a provider order created by the API. All amounts come from stored server-calculated order totals in integer paise. The API key secret never goes to the browser.

## Implemented flow

1. Authenticated checkout validates the cart and reserves inventory transactionally.
2. `/api/v1/payments/order` creates/reuses a Razorpay order. A database lease prevents simultaneous requests from creating duplicate provider orders.
3. The frontend opens Razorpay with the key ID and stored provider order ID.
4. `/api/v1/payments/razorpay/verify` checks the HMAC, fetches the payment from Razorpay, and verifies captured status, amount, currency and order ownership.
5. Payment capture commits inventory and the order in a transaction. Duplicate callbacks/webhooks do not deduct stock again.
6. Customers can retry or check payment status on the order page. Staff can reconcile from Admin → Payments.
7. `/api/v1/webhooks/razorpay` verifies the exact raw body, persists the event and processes `payment.captured` / `order.paid` idempotently. Unknown/unrecorded orders receive a retryable error. `payment.failed` marks the payment failed and keeps the order open for retry.
8. Refunds (paid cancellation, RTO and returns) call Razorpay's refund API with an idempotency key; `refund.processed` / `refund.failed` set the final status. See [FULFILMENT.md](FULFILMENT.md).

## Local configuration

`apps/api/.env` contains the user-supplied test credentials and a generated webhook secret. No values are committed or included here. `PAYMENT_PROVIDER=razorpay`, `APP_MODE=development`, `ENABLE_CHECKOUT=true`. Local development rejects live Razorpay keys. Restart the API after environment changes.

Configure automatic capture in the Razorpay test dashboard. Authorized-only payments remain pending; the app never treats authorization alone as successful payment.

For webhook delivery, configure the public HTTPS backend URL followed by `/api/v1/webhooks/razorpay` in the Razorpay dashboard. Copy the value of `RAZORPAY_WEBHOOK_SECRET` from the backend environment into the dashboard webhook secret field, and subscribe to `payment.captured`, `order.paid`, `payment.failed`, `refund.processed` and `refund.failed`. The webhook secret is separate from the API secret. Localhost is not publicly reachable, so automatic delivery cannot occur without a public test deployment or tunnel. No tunnel or dashboard configuration has been created automatically.

## Verification and limits

The test keys were accepted by a read-only Razorpay API request. The isolated integration suite covers invalid HMACs, raw-body tampering, incorrect amounts, ownership, authorized versus captured states, concurrent payment preparation, duplicate callback/webhook delivery, and reconciliation using a mocked Razorpay transport.

The real browser check also created a test provider order through the application and waited for the hosted Razorpay form to render. No payment was submitted. Temporary local check records were removed; provider test orders can remain in the Razorpay test dashboard.

Run a complete test purchase in the browser before launch and confirm it in both the Razorpay dashboard and the application. Live mode has not been enabled. Also complete one test refund and confirm the `refund.processed` webhook. Shipping uses Shiprocket when configured; see [FULFILMENT.md](FULFILMENT.md).

Reservation maintenance releases expired orders that have not started payment. Orders with a Razorpay order ID are reconciled and retained for review when no capture is found. This deliberately avoids releasing stock while an external payment may still complete. Provider-order recovery after a process failure during order creation still needs its own reviewed workflow before live launch.

References: [Standard Checkout](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/), [webhook validation](https://razorpay.com/docs/webhooks/validate-test/), [payments for an order](https://razorpay.com/docs/api/payments/fetch-payments-orders/).
