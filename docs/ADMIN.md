# Admin operations

Open `/admin` and sign in with a staff account. The navigation and API both enforce role permissions. Customers cannot call staff endpoints. Technicians see only service records assigned to them. Only a super administrator can create or change super-administrator accounts, and staff cannot disable their own access.

## Catalogue and inventory

- Products: create/edit name, slug, SKU, category, description, price in rupees, GST, stock threshold, visibility, featured status, keywords and specifications. Sample products are hidden in production.
- Categories, machines and machine models: create/edit structured records. Category slugs in use cannot be silently changed.
- Compatibility: link an existing product to an existing machine model, record verification notes, and mark verified compatibility.
- Images: upload PNG/JPEG/WebP up to 4 MB, or enter an existing `/assets/...` path or HTTPS URL. Local development uses the local storage adapter; Vercel requires S3 configuration.
- Inventory: the **Low stock** and **Out of stock** tabs list products at or below their low-stock level and products with nothing left to sell. Use **View → Adjust stock** with a signed quantity and a reason. Reservations cannot be consumed by an adjustment. Every adjustment has an idempotency key and a transactional inventory/audit record.
- Deactivate products and users with their Active field. Business records are retained for history instead of being permanently deleted.

## Operations

- Dashboard (Super Admin and Admin only), for the last 7 days, 30 days, 90 days or 12 months, compared with the period before:
  - Net sales, paid orders, average order value and new customers, with a sales chart by day, week or month. Days and months follow Indian time.
  - A **Needs attention** list (delivery exceptions, returned parcels, failed refunds, stock-outs, orders to process, labels, pickups, returns, new enquiries and service requests). Each item opens the matching filtered list.
  - The live order pipeline, recent orders (each opens the order), top products, inventory health with the lowest-stock items, and open enquiries and service requests by stage.
  - Every figure comes from stored records; the counts match the lists they link to.
- Orders: views by stage (Paid, Processing, Packed, Ready to Ship, Shipped, Delivered, Cancelled, Returns). Open an order to process, pack, book the Shiprocket shipment, choose a courier, print the label, schedule pickup, handle NDR/RTO and returns, cancel and refund. Statuses cannot be edited by hand; payment capture and courier tracking own them. See [FULFILMENT.md](FULFILMENT.md).
- Payments: inspect provider references and reconcile against Razorpay. Refunds are issued from the order and confirmed by Razorpay webhooks; admin cannot mark an order paid or a refund completed by hand.
- Shipments: queues from Ready to Ship through delivery, exceptions and NDR/RTO, with label and pickup status. Tracking arrives by Shiprocket webhook, with a scheduled sync as a backstop.
- Quotes: create a customer request, build line items with quantity/price/GST, set validity and progress the workflow. Totals are calculated on the server. SENT records are visible to the customer; changing this status does not send email.
- Enquiries and spare identification: customer response, internal notes, priority, permitted transitions and identified part selection.
- Service desk: triage, assign an active technician, schedule a visit, save internal notes and progress service states. Customer APIs exclude internal notes and assignment metadata.
- Customers, technicians and users: create accounts, edit profiles, assign permitted roles and activate/deactivate access. Initial passwords must have at least 12 characters. There is no automatic email invitation.
- Content: create draft/published/archived resources, FAQs and policies. Published resource/policy records appear at their matching frontend URL. Published banners feed the header announcement.
- Settings: manage public contact details and the header announcement. Reload the storefront to see changes. These settings do not modify server secrets or enable live payments.
- Audit: review changes and stock adjustments. Search, sort, pagination, detail views, print and CSV export of the loaded page are available.

This is the implemented operations panel. Accounting integrations, email/SMS delivery, advanced analytics and automated quote-to-order conversion are separate workflows, not represented as completed integrations.
