export const adminModules = [
  'reports',
  'products',
  'categories',
  'machines',
  'machine-models',
  'compatibility',
  'inventory',
  'orders',
  'payments',
  'shipments',
  'customers',
  'enquiries',
  'service-requests',
  'technicians',
  'find-my-spare',
  'content',
  'users',
  'audit',
  'settings',
] as const;
export type AdminModule = (typeof adminModules)[number];
export type AdminRow = Record<string, unknown>;

const labels: Record<AdminModule, string> = {
  reports: 'Dashboard',
  products: 'Products',
  categories: 'Categories',
  machines: 'Machines',
  'machine-models': 'Machine Models',
  compatibility: 'Compatibility',
  inventory: 'Inventory',
  orders: 'Orders',
  payments: 'Payments',
  shipments: 'Shipments',
  customers: 'Customers',
  enquiries: 'Enquiries',
  'service-requests': 'Service Requests',
  technicians: 'Technicians',
  'find-my-spare': 'Find My Spare',
  content: 'Website Content',
  users: 'Users & Roles',
  audit: 'Audit Logs',
  settings: 'Settings',
};
export const moduleLabel = (module: AdminModule) => labels[module];

/** One line under each page title saying what the page is for. */
export const moduleDescription: Record<AdminModule, string> = {
  reports: 'Sales, work queues, stock and customer requests at a glance.',
  products: 'Spare parts listed in the storefront catalogue.',
  categories: 'Groups that organise spare parts in the storefront.',
  machines: 'Laundry machines offered by quotation.',
  'machine-models': 'Specific machine models used for spare-part compatibility.',
  compatibility: 'Which spare parts fit which machine models.',
  inventory: 'Stock on hand, reservations and adjustments.',
  orders: 'Customer orders from payment to delivery.',
  payments: 'Payment status for every order.',
  shipments: 'Every parcel from packing to delivery: labels, pickups and live courier tracking.',
  customers: 'Customer accounts and their contact details.',
  enquiries: 'Sales enquiries and quotations, from first contact to conversion.',
  'service-requests': 'Installation, repair and maintenance jobs.',
  technicians: 'Field technicians who handle service jobs.',
  'find-my-spare': 'Customer requests to identify the right spare part.',
  content: 'Resources, FAQs, policies and banners shown on the website.',
  users: 'Staff accounts and their roles.',
  audit: 'A record of every change made by staff.',
  settings: 'Business contact details and site-wide announcements.',
};

/** Label for the single primary action on each page. */
export const createLabel: Partial<Record<AdminModule, string>> = {
  products: 'Add Product',
  categories: 'Add Category',
  machines: 'Add Machine',
  'machine-models': 'Add Model',
  compatibility: 'Add Compatibility',
  customers: 'Add Customer',
  enquiries: 'New Enquiry',
  'service-requests': 'New Service Request',
  technicians: 'Add Technician',
  'find-my-spare': 'New Request',
  content: 'Add Content',
  users: 'Add User',
  settings: 'Add Setting',
};

/** Sidebar groups. Modules listed under `tabs` share one sidebar entry and appear as page tabs. */
export const navGroups: {
  title?: string;
  items: { module: AdminModule; tabs?: AdminModule[] }[];
}[] = [
  { items: [{ module: 'reports' }] },
  {
    title: 'Catalogue',
    items: [
      { module: 'products' },
      { module: 'categories' },
      { module: 'machines', tabs: ['machines', 'machine-models'] },
      { module: 'compatibility' },
    ],
  },
  {
    title: 'Operations',
    items: [
      { module: 'orders', tabs: ['orders', 'payments'] },
      { module: 'shipments' },
      { module: 'inventory' },
    ],
  },
  {
    title: 'Sales',
    items: [{ module: 'customers' }, { module: 'enquiries' }, { module: 'find-my-spare' }],
  },
  { title: 'Service', items: [{ module: 'service-requests' }, { module: 'technicians' }] },
  { title: 'Content', items: [{ module: 'content' }] },
  {
    title: 'Management',
    items: [{ module: 'users' }, { module: 'audit' }, { module: 'settings' }],
  },
];
export function pageTabs(module: AdminModule): AdminModule[] {
  for (const group of navGroups)
    for (const item of group.items) if (item.tabs?.includes(module)) return item.tabs;
  return [];
}
export function navOwner(module: AdminModule): AdminModule {
  return pageTabs(module)[0] ?? module;
}

/** Status tabs shown above each list. Only the statuses staff work through day to day. */
/** Named operational views (server-side filters). Shipments views come with live counts. */
export const viewTabs: Partial<Record<AdminModule, { key: string; label: string }[]>> = {
  inventory: [
    { key: '', label: 'All' },
    { key: 'low', label: 'Low stock' },
    { key: 'out', label: 'Out of stock' },
  ],
  orders: [
    { key: '', label: 'All' },
    { key: 'paid', label: 'Paid' },
    { key: 'processing', label: 'Processing' },
    { key: 'packed', label: 'Packed' },
    { key: 'ready-to-ship', label: 'Ready to Ship' },
    { key: 'shipped', label: 'Shipped' },
    { key: 'delivered', label: 'Delivered' },
    { key: 'cancelled', label: 'Cancelled' },
    { key: 'returns', label: 'Returns' },
  ],
};
export const statusTabs: Partial<Record<AdminModule, string[]>> = {
  payments: ['PENDING_PAYMENT', 'PAID', 'CANCELLED'],
  enquiries: [
    'NEW',
    'CONTACTED',
    'QUOTE_PREPARED',
    'QUOTE_SENT',
    'NEGOTIATION',
    'ACCEPTED',
    'CONVERTED',
    'LOST',
  ],
  'service-requests': [
    'NEW',
    'ASSIGNED',
    'SCHEDULED',
    'IN_PROGRESS',
    'WAITING_FOR_PARTS',
    'COMPLETED',
  ],
  'find-my-spare': ['NEW', 'REVIEWING', 'NEED_MORE_INFO', 'IDENTIFIED', 'RESOLVED'],
  content: ['DRAFT', 'PUBLISHED', 'ARCHIVED'],
};

export type Column = {
  key: string;
  label: string;
  kind?: 'money' | 'status' | 'date' | 'image' | 'boolean' | 'mono' | 'stock';
  align?: 'right';
};
const record: Column[] = [
  { key: 'number', label: 'Reference', kind: 'mono' },
  { key: 'title', label: 'Subject' },
  { key: 'name', label: 'Customer' },
  { key: 'status', label: 'Status', kind: 'status' },
  { key: 'createdAt', label: 'Received', kind: 'date' },
];
export function columnsFor(module: AdminModule): Column[] {
  switch (module) {
    case 'products':
      return [
        { key: 'image', label: '', kind: 'image' },
        { key: 'name', label: 'Product' },
        { key: 'sku', label: 'SKU', kind: 'mono' },
        { key: 'category', label: 'Category' },
        { key: 'price', label: 'Price', kind: 'money', align: 'right' },
        { key: 'stock', label: 'Stock', align: 'right' },
        { key: 'active', label: 'Status', kind: 'boolean' },
      ];
    case 'inventory':
      return [
        { key: 'name', label: 'Product' },
        { key: 'sku', label: 'SKU', kind: 'mono' },
        { key: 'stock', label: 'On hand', align: 'right' },
        { key: 'reserved', label: 'Reserved', align: 'right' },
        { key: 'available', label: 'Available', align: 'right' },
        { key: 'threshold', label: 'Low-stock level', align: 'right' },
        { key: 'stockStatus', label: 'Status', kind: 'stock' },
      ];
    case 'orders':
      return [
        { key: 'number', label: 'Order', kind: 'mono' },
        { key: 'customer.name', label: 'Customer' },
        { key: 'itemCount', label: 'Items', align: 'right' },
        { key: 'total', label: 'Total', kind: 'money', align: 'right' },
        { key: 'status', label: 'Status', kind: 'status' },
        { key: 'paymentStatus', label: 'Payment', kind: 'status' },
        { key: 'fulfilmentStatus', label: 'Fulfilment', kind: 'status' },
        { key: 'shipment.status', label: 'Shipment', kind: 'status' },
        { key: 'shipment.labelStatus', label: 'Label', kind: 'status' },
        { key: 'createdAt', label: 'Date', kind: 'date' },
      ];
    case 'shipments':
      return [
        { key: 'orderNumber', label: 'Order', kind: 'mono' },
        { key: 'customerName', label: 'Customer' },
        { key: 'courierName', label: 'Courier' },
        { key: 'awb', label: 'AWB', kind: 'mono' },
        { key: 'packageText', label: 'Package' },
        { key: 'labelState', label: 'Label', kind: 'status' },
        { key: 'pickupStatus', label: 'Pickup', kind: 'status' },
        { key: 'status', label: 'Shipment', kind: 'status' },
        { key: 'expectedDeliveryAt', label: 'Expected', kind: 'date' },
        { key: 'lastUpdate', label: 'Last update', kind: 'date' },
      ];
    case 'payments':
      return [
        { key: 'number', label: 'Order', kind: 'mono' },
        { key: 'customer.name', label: 'Customer' },
        { key: 'paymentProvider', label: 'Provider' },
        { key: 'total', label: 'Amount', kind: 'money', align: 'right' },
        { key: 'paymentStatus', label: 'Payment', kind: 'status' },
        { key: 'createdAt', label: 'Date', kind: 'date' },
      ];
    case 'audit':
      return [
        { key: 'action', label: 'Action', kind: 'status' },
        { key: 'entity', label: 'Area' },
        { key: 'summary', label: 'Summary' },
        { key: 'createdAt', label: 'When', kind: 'date' },
      ];
    case 'customers':
    case 'users':
    case 'technicians':
      return [
        { key: 'name', label: 'Name' },
        { key: 'email', label: 'Email' },
        { key: 'phone', label: 'Phone' },
        ...(module === 'users' ? [{ key: 'role', label: 'Role', kind: 'status' } as Column] : []),
        { key: 'active', label: 'Status', kind: 'boolean' },
        { key: 'createdAt', label: 'Joined', kind: 'date' },
      ];
    case 'categories':
      return [
        { key: 'image', label: '', kind: 'image' },
        { key: 'name', label: 'Category' },
        { key: 'slug', label: 'URL slug', kind: 'mono' },
        { key: 'updatedAt', label: 'Updated', kind: 'date' },
      ];
    case 'machines':
      return [
        { key: 'image', label: '', kind: 'image' },
        { key: 'name', label: 'Machine' },
        { key: 'capacity', label: 'Capacity' },
        { key: 'active', label: 'Status', kind: 'boolean' },
        { key: 'updatedAt', label: 'Updated', kind: 'date' },
      ];
    case 'machine-models':
      return [
        { key: 'title', label: 'Model' },
        { key: 'data.modelNumber', label: 'Model number', kind: 'mono' },
        { key: 'data.manufacturer', label: 'Manufacturer' },
        { key: 'status', label: 'Status', kind: 'status' },
      ];
    case 'compatibility':
      return [
        { key: 'productId', label: 'Spare part', kind: 'mono' },
        { key: 'machineModelId', label: 'Machine model', kind: 'mono' },
        { key: 'verified', label: 'Verified', kind: 'boolean' },
        { key: 'updatedAt', label: 'Updated', kind: 'date' },
      ];
    case 'content':
      return [
        { key: 'title', label: 'Title' },
        { key: 'data.section', label: 'Section' },
        { key: 'data.slug', label: 'URL slug', kind: 'mono' },
        { key: 'status', label: 'Status', kind: 'status' },
        { key: 'updatedAt', label: 'Updated', kind: 'date' },
      ];
    case 'settings':
      return [
        { key: 'title', label: 'Setting' },
        { key: 'data.key', label: 'Key', kind: 'mono' },
        { key: 'data.value', label: 'Value' },
        { key: 'status', label: 'Status', kind: 'status' },
      ];
    case 'service-requests':
      return [
        { key: 'number', label: 'Request', kind: 'mono' },
        { key: 'name', label: 'Customer' },
        { key: 'data.machine', label: 'Machine' },
        { key: 'title', label: 'Issue' },
        { key: 'data.priority', label: 'Priority', kind: 'status' },
        { key: 'status', label: 'Status', kind: 'status' },
        { key: 'createdAt', label: 'Received', kind: 'date' },
      ];
    case 'find-my-spare':
      return [
        { key: 'number', label: 'Ticket', kind: 'mono' },
        { key: 'name', label: 'Customer' },
        { key: 'data.machine', label: 'Machine' },
        { key: 'data.partNumber', label: 'Part number', kind: 'mono' },
        { key: 'status', label: 'Status', kind: 'status' },
        { key: 'createdAt', label: 'Received', kind: 'date' },
      ];
    case 'enquiries':
      return [
        { key: 'number', label: 'Enquiry', kind: 'mono' },
        { key: 'name', label: 'Customer' },
        { key: 'data.company', label: 'Company' },
        { key: 'title', label: 'Subject' },
        { key: 'data.quoteTotals.total', label: 'Quote value', kind: 'money', align: 'right' },
        { key: 'status', label: 'Status', kind: 'status' },
        { key: 'updatedAt', label: 'Updated', kind: 'date' },
      ];
    default:
      return record;
  }
}

/** Reads dotted paths and a few derived values used by tables. */
export function cellValue(row: AdminRow, key: string): unknown {
  if (key === 'available') return Number(row.stock ?? 0) - Number(row.reserved ?? 0);
  if (key === 'itemCount')
    return Array.isArray(row.items)
      ? row.items.reduce((sum, item) => sum + Number((item as AdminRow).quantity ?? 0), 0)
      : undefined;
  if (key === 'labelState')
    return row.labelPrinted ? 'PRINTED' : row.labelUrl ? 'GENERATED' : 'NONE';
  if (key === 'lastUpdate') return (row.lastEvent as AdminRow | undefined)?.at ?? row.updatedAt;
  if (key === 'packageText') {
    const parcel = row.package as AdminRow | undefined;
    return parcel?.weight
      ? `${parcel.weight} kg · ${parcel.length}×${parcel.breadth}×${parcel.height} cm`
      : undefined;
  }
  if (key === 'stockStatus') {
    const available = Number(row.stock ?? 0) - Number(row.reserved ?? 0);
    return available <= 0 ? 'OUT_OF_STOCK' : available <= Number(row.threshold ?? 0) ? 'LOW' : 'OK';
  }
  return key
    .split('.')
    .reduce<unknown>(
      (value, part) => (value && typeof value === 'object' ? (value as AdminRow)[part] : undefined),
      row,
    );
}
