# Megha Platform End-to-End Audit

Audit date: 9 October 2026. Details: [TESTED_ROUTES.md](TESTED_ROUTES.md) (what was tested) and [API_AUDIT.md](API_AUDIT.md) (API results).

**How this was tested.** The website and admin panel were used in a real browser, as a customer, an admin, a technician and every staff role, on desktop and phone. The API was called directly. Everything ran on a production build against a copy of the database, so no real data was changed.

- **Scope:** 76 URLs covering 51 of the 52 page routes (`/account/find-my-spare` was not opened), about 60 API endpoints, 17 business flows, and 7 roles plus a signed-out visitor.
- **Not live:** Shiprocket has no credentials yet, so shipping used the built-in development provider plus the project's mocked Shiprocket tests. Razorpay was tested in test mode up to the hosted payment screen.
- **Evidence:** screenshots and raw results are in `.local/audit/` (local only, not committed).

## Fix status (updated 9 October 2026)

All ten P1 items are fixed, verified in a browser on a production build, and covered by automated checks (`npm run check:email` was added).

| ID      | Status             | What changed                                                                                                                                                                                                                     |
| ------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CHK-01  | Fixed              | The phone pattern works in modern browsers. All forms share one set of phone, PIN code and GSTIN rules, with plain messages.                                                                                                     |
| PRD-01  | Fixed              | The product page shows In stock / Only N left / Out of stock. The button is disabled when out of stock, and the message says "out of stock".                                                                                     |
| CHK-02  | Fixed              | Checkout sends the total the customer saw. If prices changed, the server refuses the order, and the page shows the new total and asks the customer to pay again.                                                                 |
| SEO-01  | Fixed              | Every page has its own title. Product pages include the name, price, SKU and product data in the server HTML. Missing products return 404. Added `sitemap.xml`, `robots.txt` and a favicon. Set `SITE_URL` on the frontend.      |
| ENQ-01  | Fixed              | "Send Enquiry" fills the subject with "Enquiry: <product>". Enquiries now have a quantity field.                                                                                                                                 |
| ORD-01  | Fixed              | The message now says "You cancelled this order", "cancelled by our team" or "cancelled automatically", depending on who cancelled.                                                                                               |
| NTF-01  | Fixed              | No internal keys. Notifications show a date, link to the order, show an unread count in the account menu, and have "Mark all as read". Money is formatted (₹1,593.00).                                                           |
| ERR-01  | Fixed              | Network failures say "Can't reach the server…", and admin lists have a Retry button. Field errors are plain sentences (also API-08).                                                                                             |
| AUTH-01 | Fixed              | "Forgot password?" emails a single-use link that expires in 30 minutes. A reset signs out every session and sends a "password changed" email. The same answer is given for unknown emails, and requests are rate-limited.        |
| MSG-01  | Fixed (needs SMTP) | Emails for every customer notification, request acknowledgements, staff alerts and password resets go through a database outbox with retries. Configure `EMAIL_PROVIDER=smtp` and the SMTP settings; see [VERCEL.md](VERCEL.md). |

Also fixed along the way:

- **STAT-01:** friendly request statuses.
- **SAV-01:** no duplicate saves; saved items link to the product and have Add to Cart and Remove.
- **QTE-01 (part):** customers now see the quote lines.
- **PRF-01 (part):** GSTIN and phone are validated on the profile.
- **UX-01 (part):** one heading per product page.
- **MCH-01:** the dead machine-category route was removed.
- **TEST-01:** `check:razorpay` passes again.

The P0 items (real catalogue, policies, live Shiprocket and Razorpay checks) and the remaining P2/P3 items are still open.

## 1. Overall Result

**A strong foundation. Not ready for live customers yet.**

The core of the business works and is reliable: checkout, payment safety, order fulfilment, courier tracking, returns, refunds, stock and staff permissions. It is also fast: API calls take 7–26 ms, and pages switch in under 0.1 s.

Three things block going live:

- The catalogue is still sample data.
- The legal policies are empty.
- Shiprocket and Razorpay have not been tested live.

Several customer-facing messages and labels also need fixing.

| Priority      | Count | Meaning                                |
| ------------- | ----- | -------------------------------------- |
| P0 (Critical) | 3     | Must be done before taking real orders |
| P1 (High)     | 10    | Fix before or right after launch       |
| P2 (Medium)   | 16    | Clear improvements                     |
| P3 (Low)      | 16    | Polish                                 |

**Build and test status:** all passed.

- `npm run lint`, `npm run typecheck`, unit tests (8 of 8) and Prettier.
- Integration checks `check:api`, `check:payments` and `check:fulfilment`.
- Browser checks `check:browser`, `check:admin` and `check:performance`.
- A production `next build`, run on a copy of the frontend because your preview server was using the live build folder.
- One failure: `npm run check:razorpay` fails because the test is out of date. The app itself works (TEST-01).

## 2. What Works Well

- **Permissions.**
  - All 152 combinations of role and admin section behave exactly as designed.
  - Technicians see only their own jobs.
  - Sales staff can't see revenue or change stock.
  - Admins can't create Super Admins.
- **Payments are safe.**
  - Prices and totals are always calculated on the server.
  - An order is paid only after the provider confirms it.
  - Unpaid orders can be retried or cancelled, and their stock is released.
- **Fulfilment is complete.**
  - Pack, shipment, courier, label (prints are recorded), and pickup all work.
  - An order becomes "Shipped" only when the courier scans it.
  - Duplicate or out-of-order courier updates are ignored.
  - Customers are notified once per stage.
- **Returns and refunds work end to end.** Request, approve, receive, restock and refund all work, and the order becomes "Partially refunded".
- **Stock stays consistent.** Reserved stock always matched unpaid orders, nothing went negative, every adjustment is logged with a reason, and over-deduction is refused.
- **Validation and errors are consistent.** Bad input is rejected with clear codes and one standard error format.
- **Security basics are in place.** Security headers are set, cross-site writes are blocked, uploads are checked by real file type, and webhooks require their secret. No password data is ever returned.
- **Speed.**
  - API median is 7–26 ms.
  - Storefront page changes take 48–107 ms, and admin section changes 34–60 ms.
  - The home page is ready in 92 ms locally, with 230 KB of images.
- **Responsive layout.** No page scrolls sideways at phone width, on the website, the account pages or the admin panel.
- **Navigation.** No broken internal links (40 of 40 OK), and no JavaScript crashes on any page.
- **Usability basics.** Clear empty states (for example "No matching parts found" with a Find My Spare button), loading skeletons on catalogue pages, a skip link and visible keyboard focus.
- **Admin dashboard.** Every count matches the list it links to.

## 3. Critical Problems (P0)

**GO-01: The catalogue is sample data**

- **Where:** every product, product page and admin catalogue.
- **What happens:**
  - SKUs are `DEV-MGL-001…012`, and part numbers are "Reference 001".
  - Product pages say "In stock · Development inventory" and "Reference price for local testing".
  - There are no machine models and no compatibility records, so every product says "No verified model compatibility".
- **Why it matters:** customers would see test text and order parts at prices nobody has approved.
- **Fix:** load the real catalogue (prices, GST, stock, images, part numbers), add machine models and compatibility, and remove the development wording from the product page.

**GO-02: Legal and policy pages are empty**

- **Where:** `/policies/shipping`, `/policies/privacy`, `/policies/terms`, `/policies/returns`.
- **What happens:** each says "Policy content pending approval … not accepting live purchases".
- **Why it matters:** these are legally required, and Razorpay requires them before activating live payments.
- **Fix:** write and publish them in Admin › Website Content. This was tested and they appear on the website immediately. No code change is needed.

**GO-03: Live shipping and payment are not verified**

- **What happens:** Shiprocket has never been called with real credentials, Razorpay has not taken a real test payment in the browser, and neither webhook is set up on a public URL.
- **Why it matters:** these are the parts most likely to fail on day one, and they can't be proved locally.
- **Fix:** follow [FULFILMENT.md](FULFILMENT.md):
  1. Add the Shiprocket credentials.
  2. Set up both webhooks.
  3. Book, label, collect and track one real parcel.
  4. Complete one Razorpay test payment and one refund.

## 4. High Priority Improvements (P1)

**CHK-01: The phone number check doesn't work in the browser**

- **Evidence:** "12345" was accepted at checkout. The browser logs "Pattern attribute value `[+0-9 ()\-]{10,16}` is not a valid regular expression", so it ignores the rule.
- **Impact:** the customer only finds out after pressing Pay, and the server's message appears as the raw text "customer.phone: Invalid".
- **Fix:** correct the pattern (escape it for modern browsers) and show "Enter a 10-digit mobile number".

**PRD-01: Out-of-stock products say "In stock"**

- **Evidence:** with stock set to 0, the product page still said "In stock · Development inventory" and Add to Cart stayed active. Clicking it said "Available quantity reached.", while the same product's card in the list correctly said "Out of stock".
- **Impact:** confusing, and it looks broken.
- **Fix:** show the real stock state on the product page, disable the button, and say "Out of stock".

**CHK-02: A price change is charged without telling the customer**

- **Evidence:** checkout showed a total of ₹3,070. The price changed, then the customer paid, and ₹3,306 was charged. The summary never refreshed. Razorpay's own screen shows the real amount, but the development flow does not.
- **Fix:** re-check the total when Pay is pressed. If it changed, show the new total and ask the customer to confirm.

**SEO-01: Search engines see empty, identical pages**

- **Evidence:**
  - Every page has the same title and description.
  - Product and listing pages contain no product name, price or SKU in the HTML the server sends.
  - There's no `sitemap.xml`, `robots.txt`, favicon or link-preview data.
  - A missing product returns HTTP 200 instead of 404.
- **Impact:** parts won't be found on Google, and shared links show nothing useful.
- **Fix:** give each page its own title, render product data on the server (cached), add a sitemap, robots file and favicon, and return 404 for missing products.

**ENQ-01: "Send Enquiry" from a product loses the product**

- **Evidence:** an enquiry sent from the Drain Pump page was saved as "Send an Enquiry". The product name in the link (`?item=Drain Pump`) is ignored.
- **Fix:** fill the subject (or a product field) from `?item=` and show it to staff.

**ORD-01: The wrong message after a customer cancels**

- **Evidence:** after a customer pressed "Cancel Unpaid Order", the page said it was "cancelled automatically because payment was not completed within 30 minutes".
- **Fix:** show "You cancelled this order" when the customer cancelled it.

**NTF-01: Notifications show internal codes**

- **Evidence:** each notification shows a key like "order:MEGHA-2026-000002:refund:159300" and the label "UNREAD". There's no date and no link to the order, money appears as "₹1593.00", and items can't be marked read.
- **Fix:** hide the key, show the date, link to the order, format money, add "Mark as read", and show an unread count in the header.

**ERR-01: Technical error text is shown to users**

- **Evidence:** customers and staff saw "Failed to fetch" when the network failed, both at checkout and on admin lists, and the admin lists have no Retry button. Field errors show as "customer.phone: Invalid" or "String must contain at least 5 character(s)".
- **Fix:** map network errors to "Can't reach the server. Check your connection and try again." with a Retry button, and write plain messages for each field (API-08).

**AUTH-01: No password reset**

- **Evidence:** there's no "Forgot password" link. A password-reset data model exists, but nothing uses it.
- **Impact:** checkout needs an account, so any customer who forgets their password is stuck until staff help.
- **Fix:** add forgot and reset password by email. This depends on MSG-01.

**MSG-01: No email or SMS**

- **Evidence:** order confirmations, shipping updates, quotes and refunds are in-app only. No email or SMS provider is set up.
- **Impact:** customers expect an order confirmation email, and staff aren't alerted to new enquiries.
- **Fix:** connect an email provider (and SMS/WhatsApp if wanted) for order, shipping, quote and refund messages, plus a staff alert for new requests.

## 5. UX Problems

| ID      | Priority | Where                                        | Problem                                                                                                                                                                                                                                                                                             | Recommendation                                                                                                                 |
| ------- | -------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| STAT-01 | P2       | Account › Enquiries, Service requests, Saved | Raw codes such as "CONTACTED", "QUOTE SENT", "IN PROGRESS" and "ACTIVE"                                                                                                                                                                                                                             | Use the same friendly labels as orders ("Quote sent", "In progress")                                                           |
| SRCH-01 | P2       | Search                                       | Finds names, SKUs and part numbers. Misses category names ("boiler", "dryer parts"), machine names, reversed word order ("switch pressure") and typos. The header promises "machines", but machines aren't searched. The results page is titled "Spare Parts", and the query isn't kept in the URL. | Search category and machine names too, match words in any order, title the page "Results for …", and keep the query in the URL |
| QTE-01  | P2       | Enquiries / quotations                       | The customer sees only the quote total: no lines, no PDF and no Accept button. Staff type each quote line by hand, with no product picker to pull the price.                                                                                                                                        | Show the quote lines, offer Accept/Decline and a PDF, and add a product picker for lines                                       |
| SAV-01  | P2       | Saved items                                  | Saving twice creates a duplicate, the heart never shows "saved", and the Saved page has no product link or Add to Cart                                                                                                                                                                              | Make it a toggle and link the items                                                                                            |
| PRF-01  | P2       | My Profile                                   | An invalid GSTIN ("NOTAGSTIN") is saved and then blocks checkout. Addresses are a single free-text box and are not offered at checkout.                                                                                                                                                             | Validate GSTIN; store structured addresses and let customers pick one at checkout                                              |
| CART-01 | P2       | Cart                                         | The cart lives in one browser only, so it's lost on another device. The server cart endpoints are unused (API-06).                                                                                                                                                                                  | Sync the cart to the account when signed in, or remove the unused endpoints                                                    |
| TRK-01  | P3       | "Track Order" for guests                     | Shows the sign-in form with no explanation                                                                                                                                                                                                                                                          | Add "Sign in to track your order"                                                                                              |
| UX-01   | P3       | Product page and cards                       | Two `h1` headings on each product page. Cards show the category as a lowercase slug ("washing machine parts"). "Related Spare Parts" are just the first six products.                                                                                                                               | One heading; show the proper category name; relate by category                                                                 |
| RET-01  | P3       | Return form                                  | Quantity starts at 0, so the first submit shows "Choose at least one item"                                                                                                                                                                                                                          | Start at 1 for single-item orders                                                                                              |
| ORD-02  | P3       | Order page                                   | The "Invoice" button appears on unpaid and cancelled orders. The invoice is a printed summary, not a GST invoice.                                                                                                                                                                                   | Show it only after payment; add a GST invoice later                                                                            |

## 6. Performance Problems

No real performance problems were found. These are production-build measurements on a local machine:

| Measure                                      | Result                                                                      |
| -------------------------------------------- | --------------------------------------------------------------------------- |
| API median (23 endpoints)                    | 7–26 ms. The slowest is the dashboard.                                      |
| First `/catalogue` call after the API starts | 1.0 s once, then 10 ms                                                      |
| Storefront page change after a click         | 48–107 ms                                                                   |
| Admin section change after a click           | 34–60 ms                                                                    |
| Admin order actions (pack, label, pickup…)   | Under 1 s each, including the screen update                                 |
| Home page                                    | Ready in 92 ms, 506 KB transferred in total, 230 KB of images (hero 123 KB) |
| Largest JavaScript per page                  | 154 kB (admin); 116–144 kB for the storefront                               |

Notes:

- **Development mode:** first visits under `npm run dev` take 1–2 s, because pages compile on demand. That's a developer-only delay, not a production issue.
- **Watch item:** search and listing download the whole catalogue (12 KB for 12 products). That's fine now, but it should move to server-side search and paging once the real catalogue is in the hundreds.

## 7. API Problems

See [API_AUDIT.md](API_AUDIT.md). In short:

- Guest `/me` returns 401 and logs a console error on every page (API-01, P3).
- The public catalogue shows exact stock and internal fields (API-02, P3).
- Product endpoints use different response shapes (API-03, P3).
- The per-IP rate limits are tight for an office where staff share one IP (API-04, P2).
- The order response includes unused internal fields (API-07, P3).

## 8. Admin Problems

| ID      | Priority | Problem                                                                                                                                                                                                                       | Recommendation                                                                            |
| ------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| ADM-01  | P2       | Add Product: Save jumps to the first hidden tab with an error, one field at a time (for example Price), while Name, Slug and SKU on another tab are still missing                                                             | Show a list of missing fields at the top and mark tabs that have errors                   |
| ADM-02  | P2       | "Users & Roles" says "Staff accounts" but lists customers too, duplicating Customers (API-05)                                                                                                                                 | Show staff only                                                                           |
| ADM-04  | P2       | Technician, Sales, Inventory and Service roles land on "Your role does not include this area"                                                                                                                                 | Send each role to its first allowed section, e.g. technicians to their jobs               |
| SRV-01  | P2       | Find My Spare and service requests have no photo upload, no urgency or preferred date, and free text instead of a machine picker. Technicians have no diagnosis, parts or visit-report fields and no tap-to-call or map link. | Add photo upload (private storage), urgency and machine choice; add a simple visit report |
| NEWS-01 | P2       | Newsletter sign-ups are stored, but no admin screen shows them, and there's no unsubscribe                                                                                                                                    | Add a subscriber list with CSV export and unsubscribe, or remove the box                  |
| INV-01  | P3       | Over-deduction message: "Stock cannot fall below reserved units. Refresh and retry."                                                                                                                                          | "Only N units can be removed (stock minus reserved)."                                     |
| ADM-03  | P3       | Admin search runs only on Enter, with no hint. Orders offer a meaningless "Name A–Z" sort.                                                                                                                                    | Search as you type (debounced); remove Name sort from orders                              |
| CNT-03  | P3       | Settings and Website Content are empty: no support phone, email, banner, FAQs or resources yet                                                                                                                                | Fill them in; they appear on the site immediately                                         |
| DUP-01  | P3       | `/admin/reports` is the same page as `/admin`                                                                                                                                                                                 | Redirect it to `/admin`                                                                   |

**What's good in the admin panel:**

- The dashboard, the order screen with one main action per state, shipment queues and inventory history are clear.
- The audit log records every change.
- Tables fit at laptop widths and switch to cards on phones.
- Every list has a sensible empty state.

## 9. Customer Experience Problems

The customer-facing P1 items above are the most important:

- the phone check (CHK-01);
- the "In stock" label on out-of-stock items (PRD-01);
- the silent price change (CHK-02);
- the lost product name on enquiries (ENQ-01);
- notifications (NTF-01);
- technical error text (ERR-01);
- password reset (AUTH-01);
- no emails (MSG-01).

After those, the customer journey is solid: browse, cart, checkout with delivery options, pay, track with clear stages, cancel unpaid orders, and request a return.

## 10. Useless / Duplicate Areas

| Feature                                                                                         | Recommendation                   | Reason                                                                             |
| ----------------------------------------------------------------------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------- |
| `/machines/category/[category]`                                                                 | REMOVE                           | Nothing links to it, and it shows every machine whatever the category (MCH-01, P3) |
| Home "Resources" cards (`/resources/0`, `/1`, `/2`)                                             | REMOVE until real articles exist | All three open the same generic FAQ text (CNT-02, P2)                              |
| `/admin/reports`                                                                                | MERGE into `/admin`              | Duplicate of the dashboard (DUP-01)                                                |
| `/contact` and "Enquiry" (`/bulk-quote`)                                                        | MERGE                            | The same form under two names; add a "What is this about?" choice (DUP-02, P3)     |
| Server cart endpoints (`/cart`)                                                                 | IMPROVE or REMOVE                | Never used by the website (CART-01)                                                |
| Saved Items                                                                                     | IMPROVE                          | Duplicates, no links, no saved state (SAV-01)                                      |
| Notifications page                                                                              | IMPROVE                          | Shows internal codes (NTF-01)                                                      |
| Newsletter box                                                                                  | IMPROVE or REMOVE                | Collects emails nobody can see (NEWS-01)                                           |
| "Staff administration" link in the public footer                                                | REMOVE                           | Customers don't need it; staff can bookmark `/admin` (FTR-01, P3)                  |
| `service-visits` permission                                                                     | REMOVE                           | No screen or API uses it                                                           |
| Password-reset data model                                                                       | DEFER, then use                  | Keep it for the password reset feature (AUTH-01)                                   |
| Machine Models and Compatibility                                                                | KEEP, fill in                    | Needed for "fits your machine"; currently empty (GO-01)                            |
| Legacy redirects (`/account/quotes`, `/account/company`, `/account/addresses`, `/admin/quotes`) | KEEP                             | Harmless; protect old links                                                        |

## 11. Missing Features / States

- Password reset (AUTH-01) and email or SMS messages (MSG-01).
- Photo upload on Find My Spare and service requests; a technician visit report (SRV-01).
- Customer quote acceptance and a quote PDF (QTE-01).
- A GST tax invoice with numbering and the seller's GSTIN; today it's a printed order summary.
- Cart kept across devices (CART-01).
- Sitemap, page titles, favicon and server-rendered product content (SEO-01).
- Already documented as later work: reverse pickup for returns, sending NDR actions to Shiprocket, and split shipments.

## 12. Security / Permission Issues

No security vulnerabilities were found.

**Verified:**

- Role permissions (152 of 152).
- Technician job scoping, and no Super Admin escalation.
- Other customers' orders are hidden (404).
- Sessions expire, and logout works.
- Cross-site writes and foreign origins are blocked.
- The 1 MB request limit works.
- Uploads are checked by their real file type.
- Webhooks require a token or signature, and scheduler jobs require a secret.
- Security headers are present, and no password data is returned. An apparent password-hash leak turned out to come from the audit's own test records.

**To tighten:**

- Per-user rate limits instead of per-IP (API-04, P2).
- Hide exact stock numbers from the public API (API-02, P3).
- Remove the public "Staff administration" link (FTR-01, P3).
- Configure production secrets and webhooks (GO-03).

## 13. Mobile Issues

No page scrolls sideways at 390 px.

| ID      | Priority | Problem                                                                                                                                                         | Recommendation                                                          |
| ------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| A11Y-02 | P2       | Admin menu on phone: focus doesn't move into the drawer, and Escape doesn't close it                                                                            | Move focus to the drawer, keep it there while open, and close on Escape |
| MOB-01  | P3       | Small tap targets: the product card Save and Add buttons are 24–30 px; footer links are about 20 px tall                                                        | At least 40 px for buttons and more spacing for footer links            |
| A11Y-01 | P2       | Low-contrast grey text: card categories and breadcrumbs (3.6–3.9:1), admin sidebar headings (3.0:1), chart labels and zero counts (2.5:1). WCAG AA needs 4.5:1. | Darken the muted grey (e.g. `#64748b` or darker)                        |

## 14. Recommended Priority

| Priority | Items                                                                                                                                                                |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P0**   | GO-01 real catalogue, GO-02 policies, GO-03 live Shiprocket and Razorpay check                                                                                       |
| **P1**   | CHK-01, PRD-01, CHK-02, SEO-01, ENQ-01, ORD-01, NTF-01, ERR-01, AUTH-01, MSG-01                                                                                      |
| **P2**   | STAT-01, SRCH-01, QTE-01, SAV-01, PRF-01, CART-01, ADM-01, ADM-02, ADM-04, SRV-01, NEWS-01, API-04, A11Y-01, A11Y-02, CNT-02, TEST-01 (`check:razorpay` out of date) |
| **P3**   | API-01, API-02, API-03, API-07, UX-01, RET-01, ORD-02, TRK-01, INV-01, ADM-03, CNT-03, DUP-01, DUP-02, MCH-01, MOB-01, FTR-01                                        |

## 15. Final Recommended Action Plan

1. **Business content (owner):** real catalogue, prices, stock and compatibility; the four policies; support contact details (GO-01, GO-02, CNT-03).
2. **Live integrations:** Shiprocket credentials and webhooks, one real parcel, one Razorpay test payment and refund (GO-03).
3. **Checkout fixes:** phone check, out-of-stock state, price-change confirmation, plain error messages (CHK-01, PRD-01, CHK-02, ERR-01).
4. **Accounts and messages:** password reset and order emails (AUTH-01, MSG-01).
5. **Customer polish:** notifications, friendly status labels, product name on enquiries, cancel message (NTF-01, STAT-01, ENQ-01, ORD-01).
6. **Be findable:** page titles, server-rendered product pages, sitemap and favicon (SEO-01).
7. **Admin polish:** role landing pages, product form errors, staff-only Users list, photo uploads and visit reports (ADM-04, ADM-01, ADM-02, SRV-01).
8. **Remove clutter:** dead machine-category route, placeholder resource cards, duplicate reports page, footer staff link (MCH-01, CNT-02, DUP-01, FTR-01).
9. **Accessibility:** contrast and phone drawer focus (A11Y-01, A11Y-02).
10. **Update `check:razorpay`** to match the current checkout (TEST-01).
