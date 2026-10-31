# Two Vercel projects

**For the current client presentation, use [CLIENT_DEMO_VERCEL.md](CLIENT_DEMO_VERCEL.md).**
That profile enables Razorpay test payments and demo shipping without real courier bookings.
The integration settings below describe a later live-commerce setup, not the demo defaults.

## Repository contract

- `apps/frontend/`: Next.js storefront, customer account and `/admin` interface. No database models, payment secrets or business API handlers.
- `apps/api/`: Express API, authentication, permissions, database models, commerce services, integrations, uploads and maintenance endpoints.
- `docs/`, `scripts/`, `tests/`: supporting documentation and local tooling, not additional deployed applications.

Deploy the same repository twice. Set the first project's Root Directory to `apps/frontend` and framework to Next.js. Set the second project's Root Directory to `apps/api` and framework to Express. Each directory has its own package manifest. Keep the root workspace manifest and lockfile in the repository. Enable access to files outside each project's Root Directory so the shared `packages/` workspaces are available. Use Node.js 24.x, as pinned in the project manifests.

Set `BACKEND_URL` on the frontend to the backend's HTTPS URL, without a trailing slash. `/api/*` is proxied to the backend so browser authentication cookies use the frontend origin. Set `FRONTEND_ORIGIN` on the backend to the exact frontend HTTPS origin. The backend validates origin for cookie-authenticated writes. Do not put provider secrets into `NEXT_PUBLIC_*` variables.

## Local versus deployed infrastructure

Development uses local MongoDB. The application must use a replica set for transactional checkout. Vercel cannot connect to `127.0.0.1` on your computer; supply a reachable MongoDB replica set at deployment time. No cloud database account is being created during local development.

Development product-image uploads use the local storage adapter. Vercel's function filesystem is not persistent storage. Set `STORAGE_PROVIDER=s3` and the bucket/region/credentials when deploying. Public product images are served through the API; private request attachments remain future work. Product reference assets ship with the frontend.

The Express entry point must export the app without opening a listener or seeding the database. Database connections are cached across warm invocations. Local listening and development seeding are separate commands. Maintenance work must use authenticated scheduled invocations or an external queue, never depend on `setInterval` in a Vercel Function.

Deployment is not production acceptance: approved commerce master data, policies, live payment verification, shipping configuration, backup/restore and complete workflow QA remain required.

## Environment variables

Frontend: `BACKEND_URL=https://your-api-project.vercel.app` and `SITE_URL=https://your-frontend-domain` (used for page canonical links, `sitemap.xml` and `robots.txt`).

Backend:

```dotenv
APP_MODE=production
MONGODB_URI=mongodb+srv://<credentials>@<cluster>/<database>
FRONTEND_ORIGIN=https://your-frontend-domain
ENABLE_CHECKOUT=false
PAYMENT_PROVIDER=razorpay
RAZORPAY_KEY_ID=<test-key-until-live-acceptance>
RAZORPAY_KEY_SECRET=<server-only>
RAZORPAY_WEBHOOK_SECRET=<same-as-Razorpay-dashboard>
STORAGE_PROVIDER=s3
AWS_REGION=<region>
AWS_S3_BUCKET=<bucket>
AWS_ACCESS_KEY_ID=<server-only>
AWS_SECRET_ACCESS_KEY=<server-only>
CRON_SECRET=<random-server-only-secret>
SHIPPING_PROVIDER=shiprocket
SHIPROCKET_EMAIL=<api-user-email>
SHIPROCKET_PASSWORD=<server-only>
SHIPROCKET_PICKUP_LOCATION=<pickup-location-name>
SHIPROCKET_PICKUP_PINCODE=<pickup-pin-code>
SHIPROCKET_WEBHOOK_TOKEN=<same-as-Shiprocket-webhook-token>
EMAIL_PROVIDER=smtp
EMAIL_FROM=Megha Laundry Equipment <orders@your-domain>
SMTP_HOST=<smtp-host>
SMTP_PORT=587
SMTP_USER=<smtp-user>
SMTP_PASSWORD=<server-only>
STAFF_ALERT_EMAIL=<sales-inbox>
SITE_URL=https://your-frontend-domain
```

**Email.** Customers get an email for every order, shipping, return and refund update, an acknowledgement for each enquiry or request, and password reset links; staff get an alert at `STAFF_ALERT_EMAIL` for each new request. Emails are queued in the database and sent within seconds on a long-running server. On Vercel, also schedule `/api/v1/jobs/email` every few minutes with the `CRON_SECRET` header, because serverless functions stop after responding. Use a sending domain with SPF and DKIM set up, so messages are not marked as spam. Run `npm run db:indexes` once after deploying this version.

Also schedule `/api/v1/jobs/tracking` every 15–30 minutes with the same `CRON_SECRET` header. It is the backstop for missed courier webhooks. Vercel Hobby crons run at most daily, so use Pro or an external scheduler for this job. Shipping setup, webhook URLs and the one-time database commands are in [FULFILMENT.md](FULFILMENT.md).

Do not copy the local `.env` unchanged to Vercel. Production checkout stays off until a live Shiprocket parcel test and live commerce acceptance are finished. Unpaid orders cancel automatically when their 30-minute reservation expires, releasing reserved stock. Orders with a Razorpay payment get a further 15 minutes, then Razorpay is checked: a captured payment marks the order paid, an authorized payment is left for staff review, and anything else cancels the order. A payment that arrives after cancellation is recorded as `REFUND_REQUIRED` for a staff refund. Expiry runs whenever a customer opens their orders and every minute on a long-running server. On Vercel, also schedule `/api/v1/jobs/reservations` (GET or POST) with `Authorization: Bearer <CRON_SECRET>`; Vercel Cron sends this header automatically when `CRON_SECRET` is set. There is no unauthenticated maintenance endpoint.

Official references: [Express on Vercel](https://vercel.com/docs/frameworks/backend/express), [Files and persistent storage](https://vercel.com/kb/guide/how-can-i-use-files-in-serverless-functions).
