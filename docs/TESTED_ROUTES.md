# Tested routes

Audit date: 9 October 2026. Companion to [END_TO_END_APPLICATION_AUDIT.md](END_TO_END_APPLICATION_AUDIT.md).

## How the tests were run

- **Frontend:** a production build (`next build` and `next start`) on port 3100.
- **API:** on port 5100, connected to `megha_audit`, a copy of the local database. The real database and the running dev servers were not touched.
- **Browser:** Microsoft Edge, headless, through Playwright.
  - Desktop: 1440 × 900.
  - Phone: 390 × 844, touch.
- **Load column:** time from navigation until there was no network traffic for 500 ms, so it includes Playwright's 500 ms idle wait. The real time to a usable page is about 500 ms less: the home page was ready (DOMContentLoaded) in 92 ms.
- **Not live:** Shiprocket (no credentials available) and email/SMS (not built). Payment used the development provider, and one Razorpay test-mode checkout was opened without paying.

Result codes: **OK** passed. **Issue** means it works with a problem; see the issue ID in the audit report. **Fail** means it is broken.

## Public pages (desktop and phone)

Every page below was also loaded at phone width. None scrolled sideways.

On every page:

- Guests get a `401 /api/v1/me` console error (API-01).
- The favicon returns 404 (SEO-01).
- The title and description are the same as on every other page (SEO-01).

| Route                                               | HTTP | Load (ms)          | Result                                                                             |
| --------------------------------------------------- | ---- | ------------------ | ---------------------------------------------------------------------------------- |
| `/`                                                 | 200  | 1942 (first, cold) | OK. The three resource cards link to placeholder pages (CNT-02).                   |
| `/spare-parts`                                      | 200  | 1051               | OK. Loading skeleton shown while data loads.                                       |
| `/spare-parts/washing-machine-parts`                | 200  | —                  | OK. Category filter applies.                                                       |
| `/machines`                                         | 200  | 819                | OK                                                                                 |
| `/machines/[slug]` (4 machines)                     | 200  | 651–702            | OK                                                                                 |
| `/machines/category/[category]`                     | 200  | —                  | Issue MCH-01. Shows every machine, whatever the category. Nothing links to it.     |
| `/services`                                         | 200  | 914                | OK                                                                                 |
| `/services/[slug]` (4 services)                     | 200  | 642–680            | OK. Service request form works.                                                    |
| `/product/[slug]` (12 products)                     | 200  | 669–730            | Issue PRD-01 (stock label) and UX-01 (two `h1` headings).                          |
| `/product/does-not-exist`                           | 200  | 799                | Issue. Shows "Product not found" but returns HTTP 200 (SEO-01).                    |
| `/search?q=…`                                       | 200  | 829                | Issue SRCH-01 (relevance). 14 queries tested.                                      |
| `/find-my-spare`                                    | 200  | 671                | Issue SRV-01. Form works, but there is no photo upload.                            |
| `/bulk-quote` (labelled "Enquiry")                  | 200  | 1259               | Issue ENQ-01. The product name from `?item=` is lost.                              |
| `/contact`                                          | 200  | 620                | OK. Same form as Enquiry (DUP-02).                                                 |
| `/about`                                            | 200  | 682                | OK                                                                                 |
| `/faq`                                              | 200  | 2250               | OK. One slow cold `/catalogue` call (1.0 s); later calls took 10 ms.               |
| `/resources/0`, `/1`, `/2`                          | 200  | 650–700            | Issue CNT-02. All three show the same generic text.                                |
| `/policies/shipping`, `privacy`, `terms`, `returns` | 200  | 635–651            | Issue GO-02. Every one says "Policy content pending approval".                     |
| `/cart`                                             | 200  | 722                | OK. Quantity limits work. The cart is kept in this browser only (CART-01).         |
| `/checkout` (guest)                                 | 200  | 681                | OK. Asks the user to sign in.                                                      |
| `/checkout` (signed in)                             | 200  | —                  | Issues CHK-01 (phone check broken) and CHK-02 (price not refreshed).               |
| `/order/success/[id]`                               | 200  | —                  | OK for the owner. Guests see the sign-in form.                                     |
| `/track/[orderNo]`                                  | 200  | —                  | OK for the owner. Guests see the sign-in form (TRK-01). Another customer gets 404. |
| Unknown URL                                         | 404  | 591                | OK. Clear "Page not found" page.                                                   |

**Links:** all 40 internal links found while crawling returned 200.

## Customer account (signed in)

| Route                                                       | Result                                                                                                                                         |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `/account`                                                  | OK. Dashboard counts are correct.                                                                                                              |
| `/account/profile`                                          | Issue PRF-01. Accepts an invalid GSTIN. Saved addresses are free text and are not offered at checkout.                                         |
| `/account/orders`                                           | OK. The All, Active, Delivered and Cancelled/Returned filters work.                                                                            |
| Order detail and tracking                                   | OK. Shows stages, courier, AWB and events, with no raw codes. Retry, Cancel and Return work. ORD-01: wrong message after the customer cancels. |
| `/account/enquiries`                                        | Issue STAT-01: raw status ("QUOTE SENT"). Shows only the quote total, with no lines and no accept button (QTE-01).                             |
| `/account/service-requests`                                 | Issue STAT-01: raw status ("IN PROGRESS").                                                                                                     |
| `/account/saved`                                            | Issue SAV-01. Duplicates, no product links, raw "ACTIVE" label.                                                                                |
| `/account/notifications`                                    | Issue NTF-01. Shows internal keys, no dates or links, and no way to mark items read.                                                           |
| `/account/quotes`, `/account/company`, `/account/addresses` | OK. Redirect to the merged pages (checked in the code).                                                                                        |
| Account pages on phone                                      | OK. No sideways scrolling.                                                                                                                     |

## Admin panel

Every section was opened with a fresh page load, searched, had its first record opened, and had an empty create form submitted. Every section was also opened at phone width. There was no sideways scrolling and there were no JavaScript errors anywhere.

Moving between sections inside the app took 34–60 ms.

| Route                     | Load (ms) | Rows | Record opens | Empty create form  | Result                                                                      |
| ------------------------- | --------- | ---- | ------------ | ------------------ | --------------------------------------------------------------------------- |
| `/admin` (Dashboard)      | 816       | —    | —            | —                  | OK. Counts match the linked lists.                                          |
| `/admin/products`         | 796       | 12   | yes          | blocked (4 fields) | Issue ADM-01. Validation jumps between tabs one field at a time.            |
| `/admin/categories`       | 786       | 7    | yes          | blocked            | OK                                                                          |
| `/admin/machines`         | 787       | 4    | yes          | blocked            | OK                                                                          |
| `/admin/machine-models`   | 761       | 0    | —            | blocked            | OK, but empty (GO-01).                                                      |
| `/admin/compatibility`    | 732       | 0    | —            | blocked            | OK, but empty (GO-01).                                                      |
| `/admin/orders`           | 733       | 6    | yes          | —                  | OK. Full fulfilment flow passed in the UI.                                  |
| `/admin/payments`         | 738       | 6    | yes          | —                  | OK                                                                          |
| `/admin/shipments`        | 724       | 0    | —            | —                  | OK. Queues fill once orders are packed.                                     |
| `/admin/inventory`        | 710       | 12   | yes          | —                  | OK. Adjustments and history work. INV-01: unclear over-deduction message.   |
| `/admin/customers`        | 739       | 4    | yes          | blocked            | OK                                                                          |
| `/admin/enquiries`        | 774       | 1    | yes          | blocked            | OK. The workflow is enforced and quote totals are calculated on the server. |
| `/admin/find-my-spare`    | 739       | 0    | —            | blocked            | OK. A product can be identified.                                            |
| `/admin/service-requests` | 721       | 0    | —            | blocked            | OK. A technician is required before assignment.                             |
| `/admin/technicians`      | 719       | 0    | —            | blocked            | OK                                                                          |
| `/admin/content`          | 715       | 0    | —            | blocked            | OK. A published policy appears on the website immediately.                  |
| `/admin/users`            | 733       | 5    | yes          | blocked            | Issue ADM-02. Lists customers as well as staff.                             |
| `/admin/audit`            | 784       | 5    | yes          | —                  | OK                                                                          |
| `/admin/settings`         | 798       | 0    | —            | blocked            | OK. Settings reach the website. Nothing is set up yet (CNT-03).             |
| `/admin/reports`          | —         | —    | —            | —                  | Same page as `/admin` (DUP-01).                                             |
| `/admin/quotes`           | —         | —    | —            | —                  | OK. Redirects to Enquiries.                                                 |

**Admin on phone:** the menu drawer opens. Focus does not move into it, and Escape does not close it (A11Y-02).

**Signed-in roles:**

- Technician: sees only Service Requests, and only their own job. Lands on "Your role does not include this area" (ADM-04).
- Sales, Inventory Manager and Service Manager: the same landing problem (ADM-04).

## Flows tested end to end

| Flow                                                                                                      | Result                                                                       |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Register, sign in, sign out, wrong password, expired session                                              | OK                                                                           |
| Guest cart: add, maximum quantity, increase, decrease, remove, reload                                     | OK                                                                           |
| Checkout: field validation, PIN code, delivery options, Express, totals, pay (development provider)       | Issues CHK-01 and CHK-02                                                     |
| Payment interrupted, then Retry or Cancel; stock released                                                 | OK. ORD-01: wrong message.                                                   |
| Razorpay test mode: order created, hosted checkout opens                                                  | OK. No payment submitted. `npm run check:razorpay` is out of date (TEST-01). |
| Admin: process, pack, create shipment, choose courier, label, print, schedule pickup                      | OK                                                                           |
| Courier webhooks: picked up, in transit, duplicate, out-of-order, out for delivery, delivered             | OK. Duplicates and older events ignored; customer notified once per stage.   |
| Customer tracking after delivery                                                                          | OK                                                                           |
| Return: customer request, admin approve, receive (restock), refund                                        | OK. Order shown as Partially refunded.                                       |
| Product create, then shown on the storefront; stock received; over-deduction refused                      | OK                                                                           |
| Enquiry: contacted, quote prepared (line items), quote sent; customer sees total                          | OK. QTE-01: limited customer view.                                           |
| Service request: triage, assign technician, schedule; technician sets In progress; customer sees progress | OK. SRV-01: missing fields.                                                  |
| Find My Spare: assigned, reviewing, identified                                                            | OK                                                                           |
| Media upload: PNG accepted; SVG, fake PNG and 5 MB file rejected                                          | OK                                                                           |
| Permissions: 7 roles plus anonymous × 19 admin sections, and 17 targeted actions                          | OK. 152 of 152 matched; 17 of 17 passed.                                     |
| Slow API (1.5 s), API returning 500, API offline                                                          | Mostly OK. ERR-01: raw "Failed to fetch".                                    |
