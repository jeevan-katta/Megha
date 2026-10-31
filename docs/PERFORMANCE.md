# Performance work — 9 October 2026

## How it was measured

`npm run profile -- <label>` now covers 17 API endpoints (seven samples each, with the server-side time from the `Server-Timing` header), MongoDB plans for the main lists, hard page loads, and a 21-step click sequence across storefront, cart, account and admin. For each click it records click-to-URL-change (the moment the user sees their click worked), click-to-content, API calls made and whether a loading state appeared. `WEB_URL` and `API_URL` select the servers; `LATENCY_MS` adds browser network latency to approximate a deployed site. Results are in `.local/performance/`.

## Findings

| Finding                                                                                        | Evidence                                                                                                                                                           |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The development server was the main source of lag.                                             | `next dev` took up to 7.6 s from click to page change on first visits (compiling) and 100–200 ms on revisits; a production build took 1–32 ms for the same clicks. |
| Product, machine, service, category, order, policy and resource pages could not be prefetched. | They rendered on request, so with 150 ms latency a product click showed nothing for 348 ms.                                                                        |
| Every storefront page waited for the whole catalogue.                                          | Content pages and the home page hero rendered only "Loading catalogue…", which was also the only content in the static HTML.                                       |
| Admin and account data loaded only after a click.                                              | With 150 ms latency, first visits to admin sections took 214–349 ms behind a loading state.                                                                        |
| API and database were not bottlenecks.                                                         | Endpoint medians 12–66 ms locally; every measured list query uses an index with no in-memory sort.                                                                 |

Turbopack was measured for development and not adopted: pages after the first compiled faster (about 1 s versus 1–4 s) but the first page took 41 s and revisits were slower.

## Changes

- Dynamic storefront pages render each path once on first visit and are then cached (`generateStaticParams` returning no paths). Their data still loads in the browser, so the cached output holds no catalogue or customer data, and links to them are fully prefetched.
- Only pages that read the catalogue wait for it. The home page hero, content pages and forms render immediately; catalogue sections show a skeleton instead of a text message.
- Admin sidebar items prefetch their list data on hover, focus or press, and the busiest screens (Dashboard, Orders, Products, Inventory, Shipments) are warmed once the browser is idle. Account tabs, the header account link and the staff administration link prefetch the same way. Prefetches fill the exact cache entries the pages read.
- Razorpay is asked about an expired order at most every five minutes, so customers opening their orders never wait on repeated provider calls.
- The product save (heart) button shows a busy state and ignores repeat clicks while saving.
- Browser checks and the profiler accept `WEB_URL`; the admin check follows the redesigned admin screens.

## Results (production build, 150 ms simulated latency)

| Interaction                                                          |                       Before |                      After |
| -------------------------------------------------------------------- | ---------------------------: | -------------------------: |
| Product page: click to page change                                   |                       348 ms |                    1–15 ms |
| Admin Products, Inventory, Orders, Shipments: first visit to content |    214–349 ms, loading state | 16–52 ms, no loading state |
| Account Orders and Enquiries: first visit to content                 |                      ~205 ms |                     8–9 ms |
| Home page hero visible on a fresh load                               | after the catalogue (~1.1 s) |                 250–290 ms |
| Home page catalogue content on a fresh load                          |   1,769 ms (one cold sample) |             1,018–1,141 ms |

Sections that are neither warmed nor hovered first (for example Customers) still take one request on first visit (about 220–250 ms with 150 ms latency); real pointer movement normally starts their prefetch before the click. Cached revisits across storefront, account and admin take 7–67 ms with no API calls.

To judge speed, run `npm run build` then `npm run preview`. `npm run dev` compiles pages on first visit and does not prefetch, so it is always slower.

`npm run dev` uses Turbopack. Measured from a cold start in a real browser, it roughly halved development compile lag compared with the webpack dev server:

| Measurement                       | webpack dev | Turbopack dev |
| --------------------------------- | ----------: | ------------: |
| First admin load                  |      18.3 s |         9.1 s |
| First visit to each admin section |   1.4–2.7 s |     0.9–1.5 s |
| Revisit                           |  240–370 ms |    355–895 ms |

The production build answers the same clicks in 1–52 ms.

`npm run preview` runs the API without file watching, so it keeps serving the code it started with. Stop it before running `npm run dev`. Both commands now refuse to start while port 3000 or 5000 is in use, and the API exits with an explanation instead of reporting "ready" on a busy port.

---

# Performance work — 8 October 2026

## Measurement

The application was measured before changes in both development and production frontend modes. The API used the existing local MongoDB replica set and test/development configuration. These are local measurements, not Vercel or large-dataset load-test results.

`npm run profile -- <label>` records five samples per endpoint, response sizes, MongoDB execution plans, and a fixed sequence of real browser link clicks. Results are written to `.local/performance/<label>.json`. It creates and removes its own temporary staff session without reading passwords. Browser navigation includes Playwright click/action overhead as well as rendering; the diagnostic output separates these times.

Baseline files: `baseline-dev.json` and `baseline-production.json`. The final result is `final-production.json`; intermediate diagnostic runs are retained too.

| Measurement                                  | Production baseline | Final production preview |
| -------------------------------------------- | ------------------: | -----------------------: |
| API requests across the navigation sequence  |                  12 |                        7 |
| Account orders reads                         |                   3 |                        1 |
| Admin products reads                         |                   3 |                        1 |
| Admin reports reads                          |                   2 |                        1 |
| Return to account dashboard                  |              120 ms |                    96 ms |
| First return to admin products               |              171 ms |                    93 ms |
| Return to reports                            |              142 ms |                    93 ms |
| Second return to admin products              |               82 ms |                   101 ms |
| First admin dashboard visit                  |              174 ms |                   175 ms |
| Homepage ready                               |            1,030 ms |                 1,003 ms |
| Endpoint median range (five samples each)    |            16–44 ms |                 21–46 ms |
| Measured list queries with in-memory sorting |              4 of 4 |                   0 of 4 |

These results show fewer requests and faster first repeat visits, not uniformly faster individual samples or raw APIs. All final cached account/admin visits made zero API calls; measured post-click rendering took 13–44 ms. An extra route loading boundary was tested and removed after it delayed the first admin transition; existing data-level loading indicators were retained. Cold initial-load times and development compilation should not be compared directly with cached navigation.

## Findings and changes

- Development page compilation caused some first visits to take 2–3 seconds. Added `npm run preview` to run the production frontend build locally, with the same local API configuration. Use `npm run dev` when editing and `npm run build` followed by `npm run preview` when evaluating speed. Run only one frontend server/build against the same output directory at a time.
- Account orders were requested three times across dashboard/orders/back navigation. Admin products were requested three times and reports twice. Added TanStack Query with 30-second freshness and five-minute garbage collection for those reads. Keys include the current user and all list filters/page/sort values. Account dashboard and orders share the same read. Successful mutations invalidate affected resources; login/logout/profile session changes clear private query data. Checkout totals, authentication, RBAC, and payment decisions are not cached by this layer.
- Admin forms fetched all lookups whenever opened, including forms without lookup fields. Forms now fetch only when they need lookup fields and share a two-minute lookup cache. Catalogue mutations invalidate that cache. Manual refresh remains available; overlapping refresh callbacks reuse the active request.
- Every product card subscribed to cart, notification, authentication, runtime, and catalogue state. Product actions now have a stable, narrow context; catalogue views have a separate context. Product cards are memoized, filtering/sorting is memoized, and setting an identical cart is a no-op.
- Rapid cart updates could leave older validations running and overwrite newer totals. Superseded cart/checkout requests are aborted. Totals still come from the server, and order/payment validation is unchanged.
- Admin editing/detail components were included in the initial admin bundle. They now load when opened, with immediate loading feedback. Existing page/data loading feedback remains in place, and cached screens keep their data visible.
- MongoDB execution plans showed in-memory `SORT` stages for customer orders, admin products, customer lists, and service request lists. Added matching compound indexes, plus indexes for inventory history, audit chronology, reservation expiry, and provider order lookup. Session reads select only the user reference; session/user/rate-limit reads avoid unnecessary document hydration. Permission checks still execute on every API request.
- Added the `Server-Timing` response header to JSON endpoints so execution time, including auth/database work, can be inspected in browser network tools.
- Existing assets were already tiny WebP files (largest approximately 33 KB). Switched the image wrapper to `next/image` with intrinsic dimensions, priority loading for the logo/hero, and lazy loading elsewhere. Kept the original compressed bytes (`unoptimized`) rather than recompressing/upscaling small images or breaking arbitrary existing media URLs. Larger future uploads would need separate responsive image work.
- Unrelated admin saves no longer trigger a catalogue fetch/loading cycle. Product, inventory, category, machine and service changes retain their catalogue refresh.

## Work deliberately retained

Existing route-level Server Components and `next/link` prefetching remain. Interactive screens still require client components. Catalogue queries, list/count queries, lookups, and dashboard metrics already execute independent reads in parallel. No per-row N+1 query was found in the reviewed list/dashboard paths. Dashboard medians were already tens of milliseconds, so no shared server cache was added for financial/reporting data.

Existing admin pagination (25 by default, bounded by the API), customer list limits and catalogue behavior remain unchanged. The small local dataset does not validate performance at thousands of products or orders. Existing substring search semantics were preserved; replacing them with text search would change matching behavior. No routes, business rules, forms, prices, or features were removed.

## Verification

- `npm run lint`
- `npm run typecheck`
- `npm test` — commerce/security tests plus cache deduplication, invalidation, and user isolation
- `npm run check:api` — isolated database; RBAC, CRUD, stock, checkout, privacy, search, audit
- `npm run check:payments` — isolated database and mocked Razorpay transport
- `npm run build`
- `npm run check:browser` — desktop/mobile home and cart, no browser errors/overflow
- `npm run check:admin` — dashboard, cached tabs/lookups, lazy forms, inventory, mobile, logout protection
- `npm run check:performance` — search/filter/sort, product detail, rapid cart changes with deliberately reordered responses, one catalogue read and no full-page reloads

Apply declared indexes to another configured database with `npm run db:indexes`. This creates indexes; it does not drop collections or synchronize away existing indexes.

Raw timings fluctuate with process startup and workstation load. Repeat-request elimination and indexed query plans are stronger evidence than small differences between individual millisecond samples. TanStack Query and `next/image` add shared client JavaScript; lazy admin forms offset some of that cost. The change prioritizes repeat navigation and correctness rather than claiming a smaller initial bundle.
