# MEGHA phase-one client demonstration

Prepared on 31 October 2026. This is a presentation database, not a live trading database.

## Data prepared

Counts below describe the initial import. New orders placed during demonstrations increase them.

The dedicated Atlas database is `megha_client_demo` on the supplied cluster. The original
local `megha_laundry` database is preserved. Existing IDs, accounts and password hashes were
copied, so the seven role accounts continue to use their existing passwords.

| Area                                                    | Total records |
| ------------------------------------------------------- | ------------: |
| Products / categories / machines                        |    12 / 7 / 4 |
| Users, including all seven roles                        |            16 |
| Orders, including 36 newly added examples               |            40 |
| Shipments / tracking events                             |       32 / 96 |
| Enquiries and quotations                                |            14 |
| Service requests                                        |            11 |
| Find My Spare requests                                  |             8 |
| Returns / refunds                                       |         4 / 3 |
| Machine models / unverified example compatibility links |         4 / 4 |

The customer account also has saved items, addresses and notifications. A database cart is
included, but the existing storefront uses browser-local cart storage: add products to the
cart on the presentation browser before the walkthrough. Signing in does not load the database
cart into that screen. Inventory
includes in-stock, low-stock and out-of-stock examples. Order dates span several weeks so
dashboard charts and date filters have data. All newly added business transactions are
labelled DEMO. Quotation totals and order amounts use integer paise, as the application expects.
Synthetic shipment numbers are not real courier AWBs. Refund entries illustrate states;
no money was transferred. Compatibility examples are explicitly unverified.

The copied products were made visible in the demo database by clearing `developmentOnly`.
The original local product flags and stock were not changed. A demo announcement identifies
the deployment as sample data. Product, category, machine and hero images already live in
`apps/frontend/public/assets` and deploy with the frontend.

Active login sessions, password-reset tokens, rate-limit buckets and email queues are not
migrated. Users sign in again. Existing business records, audit records, inventory history,
counters and upload metadata are retained. The one existing uploaded file is not referenced
by the current catalogue; local upload files are backed up separately. New media uploads need
S3 before they can be used on Vercel; local disk storage is not enabled there.

## Deploy the existing repository as two Vercel projects

Keep the complete MEGHA repository together, including root `package.json`, lockfile and
`packages/`. Do not upload only the frontend folder. Use Node.js 24.x for both projects. Import the same repository twice:

| Setting                                     | API project                 | Frontend project            |
| ------------------------------------------- | --------------------------- | --------------------------- |
| Suggested name                              | megha-api-demo              | megha-client-demo           |
| Root Directory                              | `apps/api`                  | `apps/frontend`             |
| Framework                                   | Express                     | Next.js                     |
| Build Command                               | Automatic Express defaults  | Automatic Next.js defaults  |
| Include source files outside Root Directory | Enabled                     | Enabled                     |
| Install Command                             | Automatic workspace install | Automatic workspace install |

Use the generated private env files under `.local/client-demo/` when entering environment
variables in Vercel. They are excluded from Git and Vercel source upload. Never put the MongoDB
URI in a `NEXT_PUBLIC_` variable or the frontend source.

1. Create the API project and enter the backend variables below. Choose the intended stable
   frontend URL for `FRONTEND_ORIGIN` and `SITE_URL` (update it after the frontend URL is assigned).
2. Deploy the API. Open `https://YOUR-API.vercel.app/api/v1/health`; expect status `ok` and
   mode `production`. Atlas Network Access must permit the deployment's connections.
3. Create the frontend project. Set `BACKEND_URL` to the deployed API origin, with no trailing
   slash. Set its `SITE_URL` to the frontend's public origin.
4. Set the API's `FRONTEND_ORIGIN` and `SITE_URL` to that exact frontend origin, and redeploy
   the API. If multiple origins are needed, `FRONTEND_ORIGIN` accepts a comma-separated list.
5. Redeploy the frontend after changing `BACKEND_URL`: rewrites are generated at build time.
6. Keep access to the client demonstration limited to your presentation audience. If Vercel
   deployment protection blocks calls from the frontend to the API, configure access for those
   calls; a Vercel sign-in page returned from `/api` is not an application login error.

The frontend proxies `/api/*` to the API. Customers use one frontend URL, including for login
and the admin panel. The backend should not be used as a second browser login destination.

### API environment

```dotenv
APP_MODE=production
MONGODB_URI=<copy from the private backend env file>
FRONTEND_ORIGIN=https://YOUR-FRONTEND.vercel.app
SITE_URL=https://YOUR-FRONTEND.vercel.app
PAYMENT_PROVIDER=razorpay
RAZORPAY_KEY_ID=<copy your rzp_test_ key from the private backend env file>
RAZORPAY_KEY_SECRET=<copy your test secret from the private backend env file>
SHIPPING_PROVIDER=demo
EMAIL_PROVIDER=disabled
STORAGE_PROVIDER=disabled
ENABLE_CHECKOUT=true
PINCODE_LOOKUP=disabled
```

Do not copy the entire development `.env` into Vercel. Production intentionally rejects
development payment/shipping/email providers and local file storage. The `demo` shipping
provider is permitted on Vercel only with Razorpay test keys. It quotes ₹120 standard or ₹240
express delivery and supplies clearly labelled demonstration shipments and labels. No real
courier is contacted. Live Razorpay keys are rejected while this provider is selected.
Shiprocket, SMTP and S3 credentials are not needed for the checkout demonstration.
Do not configure scheduled jobs or courier webhooks for synthetic shipments.

### Frontend environment

```dotenv
BACKEND_URL=https://YOUR-API.vercel.app
SITE_URL=https://YOUR-FRONTEND.vercel.app
```

## Presentation flow

1. Open the home page, categories, product search, machine details and services.
2. Sign in with `customer@megha.com` and the existing password. Add products to the cart in
   that browser, then show the cart,
   orders, a tracking timeline, enquiries, quotations, service requests and saved items.
3. Sign in with `superadmin@megha.com` or `admin@megha.com`. Show the dashboard, its date
   filters, products, inventory, orders, shipments, quotations and the customer list.
4. Use `sales@megha.com`, `inventory@megha.com`, `service@megha.com` and
   `technician@megha.com` to demonstrate role-specific access. The technician has assigned jobs.
5. Explain that the pre-populated payment, delivery and refund states are examples. For a new
   order, enter a valid six-digit PIN, city and state, choose a demo delivery option, accept the
   test-order checkbox and click **Pay with Razorpay (Test)**. Complete a Razorpay test payment
   (Netbanking opens a mock bank page with a **Success** option). The customer account and
   admin Orders screen show the resulting order. No real money is collected.
6. Real courier bookings, outgoing emails and new uploads on Vercel remain disabled. Demo
   shipping can demonstrate packing, booking, AWB, label and pickup states; it does not invent
   courier scans or automatically mark a parcel delivered.

If checkout still says it is unavailable, verify the deployed API's `/api/v1/config` returns
`checkoutEnabled: true`, `paymentProvider: "razorpay"` and `testPayments: true`. Redeploy the
API after updating its variables, deploy the updated code (older code does not accept
`SHIPPING_PROVIDER=demo`), and refresh the browser. Changing only a local `.env` does not
update a Vercel deployment. `JWT_SECRET` is not used by the current session-based login.

For a public launch, use a separate production database with approved commercial data,
real integrations and non-demo account credentials. Do not treat sample sales as real revenue.

## Backup and repeatability

- `.local/client-demo/source-backup.ejson`: original local snapshot, with BSON types preserved.
- `.local/client-demo/prepared-demo.ejson`: the exact prepared presentation data.
- `.local/client-demo/uploads-backup/`: original local uploaded files.
- `.local/client-demo/api-env-before-atlas.env`: previous API connection settings.
- `.local/client-demo/atlas-import-report.json`: imported counts and snapshot checksum.
- `scripts/prepare-client-demo.mjs`: preparation/import utility. Refuses occupied destinations,
  preserves existing account hashes, imports transactionally, and skips an identical completed
  import rather than overwriting subsequent demo edits. Never add it to application startup.

No Vercel deployment is created by this preparation task. Local checks do not verify Vercel's
network access, assigned domains or environment settings; test those after deployment.

## Verification completed

- Lint and workspace TypeScript checks passed; the two changed scripts also passed lint.
- All 10 unit tests passed, including hosted demo shipping and rejection of live payment keys.
- The production build passed and generated 53 pages.
- 102 production-mode API checks passed against Atlas, including all seven roles, permitted
  modules, access restrictions, customer orders and order details.
- Before enabling interactive payments, 19 browser screen checks passed using the built frontend and Atlas-connected API. These
  covered storefront, search, products, cart, customer screens, admin, technician jobs and mobile
  home. Checkout was disabled during those earlier checks. The current configuration above
  enables test checkout and demo shipping instead.
- 393 imported documents validated against their Mongoose schemas; 17 referenced static
  catalogue image paths exist. All 82 original local business records matched the backup.
- Existing non-blocking Next.js warnings remain for ESLint plugin detection and social-image
  `metadataBase`; neither prevented the build or screen checks.

The app is running locally at `http://127.0.0.1:3000`, with the API at port 5000. Both use the
Atlas demo database. If the machine restarts, run `npm run dev` from the MEGHA root. Atlas
connections no longer require the startup script to launch a local MongoDB process.

### Interactive test payment verified

On 31 October 2026, customer checkout created order **MEGHA-2026-000004** for **₹1,595.00**
(₹1,250 product, ₹225 GST, ₹120 demo shipping). Razorpay's hosted test checkout and mock-bank
Success action completed. The existing backend verified the payment and stored **CAPTURED**;
the order is **CONFIRMED** in both the customer account and admin order details. The payment
was not mocked by the application and was not marked paid through a database edit.
No real money or courier booking was involved. This order remains in Atlas for the presentation.

The backend env template and local API now enable test checkout. Deploy the changed application
code together with the environment variables above; updating variables on an older deployment
alone will not add the new demo shipping provider.

References: [Vercel Express deployment](https://vercel.com/docs/frameworks/backend/express),
[Vercel shared monorepo files](https://vercel.com/docs/monorepos/monorepo-faq),
[MongoDB Atlas connection requirements](https://www.mongodb.com/docs/atlas/connect-to-database-deployment/).
