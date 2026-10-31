# Megha Laundry Equipment

One repository, two applications: **Next.js frontend** and **Node.js / Express API**, both written in TypeScript. The storefront, customer account and admin panel belong to the frontend. All database access, authentication and business operations belong to the API.

## Deploy the client demo on Vercel

Import this repository twice, using **Node.js 24.x** and these Root Directories:

| Project  | Root Directory  | Framework | Build settings                              |
| -------- | --------------- | --------- | ------------------------------------------- |
| API      | `apps/api`      | Other     | Explicit Node function; no build command    |
| Frontend | `apps/frontend` | Next.js   | Automatic framework defaults (`next build`) |

Keep **Include source files outside the Root Directory** enabled in both projects. Shared
workspace packages and the root lockfile must be available. Do not set an output directory
or run the root workspace build as the build command of either individual Vercel project.

Deploy the API first, then set its URL as the frontend's `BACKEND_URL`. Set the API's
`FRONTEND_ORIGIN` and both projects' `SITE_URL` to the frontend URL. Redeploy after changing
environment variables. Use the secret-free [API template](apps/api/.env.vercel.example) and
[frontend template](apps/frontend/.env.vercel.example), entering real values privately in Vercel.

Client-demo checkout uses `PAYMENT_PROVIDER=razorpay`, **test** Razorpay credentials,
`ENABLE_CHECKOUT=true` and `SHIPPING_PROVIDER=demo`. The demo shipping provider returns sample
rates and never books a real courier; it rejects live payment keys. No database seeding runs
during install, build or application startup. Existing Atlas data remains separate from GitHub.

Read the [client-demo deployment guide](docs/CLIENT_DEMO_VERCEL.md) for the exact setup and
presentation workflow. [Live-commerce setup](docs/VERCEL.md) is a separate deployment profile.

```text
MEGHA/
  apps/
    frontend/           Next.js storefront, account and /admin
      src/app/          Explicit page routes and layouts
      src/features/     Feature components, forms and hooks
      src/components/   Reusable layout and UI components
      src/providers/    Client application state
      src/lib/          HTTP client and formatting
    api/                Express backend
      src/app.ts        Application composition; no listener
      src/server.ts     Local development listener
      src/modules/      Domain models, services, repositories and routes
      src/integrations/ Razorpay, storage and shipping adapters
      src/middleware/   Authentication, permissions, errors and rate limits
      src/jobs/         Authenticated reservation maintenance
      src/database/     Cached MongoDB connection and model helpers
      api/index.ts      App export
  packages/
    types/              Shared DTOs
    validation/         Shared Zod input contracts
    constants/          Roles, permissions and state transitions
    ui/                 Shared status/loading components
    config/             Public application constants
  tests/                Domain tests
  scripts/              Development and integration/browser checks
  docs/                 Architecture, deployment and feature coverage
```

## Run locally

Requirements: Node.js 24.x and MongoDB configured as a replica set for transactions.

```powershell
npm install
npm run dev
```

- Storefront: <http://127.0.0.1:3000>
- Admin: <http://127.0.0.1:3000/admin>
- API health: <http://127.0.0.1:5000/api/v1/health>

`npm run dev` reloads code changes (Turbopack for the frontend, `tsx watch` for the API). `npm run preview` serves the last `npm run build` and does not reload. Stop one with Ctrl+C before starting the other; both refuse to start while port 3000 or 5000 is in use.

The client-demo configuration uses MongoDB Atlas. For local-only development, the existing
Windows helper starts an isolated replica set on **27018**; `.env.example` defaults to 27017.
Set `MONGODB_URI` to the database you intend to use. The development launcher starts local
MongoDB only when the configured URI selects the workspace instance on port 27018.

For a new checkout, copy `apps/api/.env.example` to `apps/api/.env`, set the replica-set URI, and run `npm run seed` once. Seeding is explicit and development-only. Local admin credentials are in `apps/api/.local/admin-credentials.txt`; they are not committed. The refactor preserved the existing database and moved the credential file with the backend.

Razorpay is configured in **test mode** on this machine. Keys and the webhook secret stay in `apps/api/.env`. Authentication uses revocable, database-backed HttpOnly cookie sessions; `JWT_SECRET` is not used.

## Verify

```powershell
npm run typecheck
npm run lint
npm test
npm run check:api
npm run check:payments
npm run check:fulfilment
npm run check:email
npm run check:browser
npm run check:admin
npm run build
```

API/payment integration checks create and remove only uniquely named temporary databases on the local replica set. Payment and fulfilment checks mock the Razorpay and Shiprocket network transports. Browser checks require the local app and Microsoft Edge. Stop the frontend dev server before `npm run build` so Next.js does not share build output between processes.

See [admin guide](docs/ADMIN.md), [Razorpay setup](docs/RAZORPAY.md), [orders, shipping and tracking](docs/FULFILMENT.md), [architecture and coverage](docs/ARCHITECTURE.md), and [Vercel deployment](docs/VERCEL.md). Hosted demo checkout works with test payments and demo shipping. Real commerce requires approved catalogue data, live integrations and acceptance testing.
