import { roles } from '@megha/constants';
import type { AdminModule, AdminRow } from './admin-config';
export type Field = {
  name: string;
  label: string;
  type?:
    | 'text'
    | 'textarea'
    | 'number'
    | 'money'
    | 'checkbox'
    | 'password'
    | 'email'
    | 'select'
    | 'keywords'
    | 'specifications';
  required?: boolean;
  options?: readonly string[];
  lookup?: string;
  default?: string | number | boolean;
  /** Groups long forms into tabs; fields without a section share one panel. */
  section?: string;
};
const title: Field = { name: 'title', label: 'Title', required: true };
const name: Field = { name: 'name', label: 'Name', required: true };
const slug: Field = { name: 'slug', label: 'URL slug', required: true };
const image: Field = {
  name: 'image',
  label: 'Image path or HTTPS URL',
  required: true,
  default: '/assets/part-0.webp',
};
const description: Field = { name: 'description', label: 'Description', type: 'textarea' };
const active: Field = { name: 'active', label: 'Active', type: 'checkbox', default: true };
const specifications: Field = {
  name: 'specifications',
  label: 'Specifications (one Label: Value per line)',
  type: 'specifications',
};
export const formFields: Partial<Record<AdminModule, Field[]>> = {
  products: [
    { ...name, section: 'Basic' },
    { ...slug, section: 'Basic' },
    { name: 'sku', label: 'SKU', required: true, section: 'Basic' },
    { name: 'partNumber', label: 'Part number', section: 'Basic' },
    {
      name: 'category',
      label: 'Category',
      type: 'select',
      lookup: 'categories',
      required: true,
      section: 'Basic',
    },
    { ...description, section: 'Basic' },
    { ...active, label: 'Published in storefront', section: 'Basic' },
    { name: 'featured', label: 'Featured product', type: 'checkbox', section: 'Basic' },
    {
      name: 'developmentOnly',
      label: 'Sample product (hidden in production)',
      type: 'checkbox',
      default: true,
      section: 'Basic',
    },
    { name: 'price', label: 'Price (₹)', type: 'money', required: true, section: 'Pricing & Tax' },
    {
      name: 'gstRate',
      label: 'GST rate (%)',
      type: 'number',
      default: 18,
      section: 'Pricing & Tax',
    },
    {
      name: 'threshold',
      label: 'Low stock threshold',
      type: 'number',
      default: 5,
      section: 'Inventory',
    },
    { name: 'weight', label: 'Shipping weight (kg)', type: 'number', section: 'Shipping' },
    { name: 'length', label: 'Packed length (cm)', type: 'number', section: 'Shipping' },
    { name: 'breadth', label: 'Packed width (cm)', type: 'number', section: 'Shipping' },
    { name: 'height', label: 'Packed height (cm)', type: 'number', section: 'Shipping' },
    { ...image, section: 'Media' },
    { ...specifications, section: 'Specifications' },
    {
      name: 'keywords',
      label: 'Search keywords (comma separated)',
      type: 'keywords',
      section: 'Search',
    },
  ],
  categories: [name, slug, image],
  machines: [
    name,
    slug,
    image,
    { name: 'category', label: 'Category slug', required: true },
    { name: 'capacity', label: 'Capacity range', required: true },
    description,
    active,
    specifications,
  ],
  'machine-models': [
    title,
    description,
    { name: 'status', label: 'Status', type: 'select', options: ['ACTIVE', 'INACTIVE'] },
    {
      name: 'data.machineId',
      label: 'Machine',
      type: 'select',
      lookup: 'machines',
      required: true,
    },
    { name: 'data.manufacturer', label: 'Manufacturer' },
    { name: 'data.modelNumber', label: 'Model number', required: true },
  ],
  compatibility: [
    { name: 'productId', label: 'Spare part', type: 'select', lookup: 'products', required: true },
    {
      name: 'machineModelId',
      label: 'Machine model',
      type: 'select',
      lookup: 'models',
      required: true,
    },
    { name: 'verified', label: 'Compatibility verified by technical team', type: 'checkbox' },
    { name: 'notes', label: 'Verification notes', type: 'textarea' },
  ],
  content: [
    title,
    description,
    {
      name: 'status',
      label: 'Status',
      type: 'select',
      options: ['DRAFT', 'PUBLISHED', 'ARCHIVED'],
    },
    { name: 'data.slug', label: 'URL slug', required: true },
    {
      name: 'data.section',
      label: 'Section',
      type: 'select',
      options: ['resource', 'faq', 'policy', 'banner'],
    },
  ],
  settings: [
    title,
    description,
    { name: 'status', label: 'Status', type: 'select', options: ['ACTIVE', 'INACTIVE'] },
    {
      name: 'data.key',
      label: 'Setting',
      type: 'select',
      options: ['support_phone', 'support_email', 'business_address', 'announcement'],
    },
    { name: 'data.value', label: 'Value', required: true },
  ],
};
export function fieldsFor(module: AdminModule, creating: boolean, role: string): Field[] {
  if (['users', 'technicians', 'customers'].includes(module))
    return [
      name,
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'phone', label: 'Phone' },
      {
        name: 'role',
        label: 'Role',
        type: 'select',
        options:
          module === 'customers'
            ? ['CUSTOMER']
            : module === 'technicians'
              ? ['TECHNICIAN']
              : roles.filter((value) => role === 'SUPER_ADMIN' || value !== 'SUPER_ADMIN'),
      },
      active,
      ...(creating
        ? [
            {
              name: 'password',
              label: 'Initial password (at least 12 characters)',
              type: 'password' as const,
              required: true,
            },
          ]
        : []),
    ];
  if (creating && ['enquiries', 'service-requests', 'find-my-spare'].includes(module))
    return [
      title,
      name,
      { name: 'email', label: 'Customer email', type: 'email', required: true },
      { name: 'phone', label: 'Phone', required: true },
      { ...description, required: true },
      { name: 'data.company', label: 'Company' },
      { name: 'data.machine', label: 'Machine / model' },
      { name: 'data.location', label: 'Location' },
    ];
  return formFields[module] ?? [];
}
export function fieldValue(row: AdminRow, field: Field) {
  const value =
    field.name
      .split('.')
      .reduce<unknown>(
        (object, key) =>
          object && typeof object === 'object' ? (object as AdminRow)[key] : undefined,
        row,
      ) ??
    field.default ??
    (field.type === 'checkbox' ? false : '');
  if (field.type === 'money') return value === '' ? '' : Number(value) / 100;
  if (field.type === 'keywords' && Array.isArray(value)) return value.join(', ');
  if (field.type === 'specifications' && Array.isArray(value))
    return value.map((item) => `${item.label}: ${item.value}`).join('\n');
  return value;
}
export function formPayload(fields: Field[], form: FormData): AdminRow {
  const result: AdminRow = {};
  for (const field of fields) {
    const raw = String(form.get(field.name) ?? '');
    const value =
      field.type === 'checkbox'
        ? form.has(field.name)
        : field.type === 'number'
          ? Number(raw)
          : field.type === 'money'
            ? Math.round(Number(raw) * 100)
            : field.type === 'keywords'
              ? raw
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean)
              : field.type === 'specifications'
                ? raw
                    .split('\n')
                    .filter((s) => s.trim())
                    .map((line) => {
                      const index = line.indexOf(':');
                      return {
                        label: index < 0 ? line.trim() : line.slice(0, index).trim(),
                        value: index < 0 ? '' : line.slice(index + 1).trim(),
                      };
                    })
                : raw;
    const [key, nested] = field.name.split('.');
    if (nested) result[key] = { ...((result[key] as AdminRow) ?? {}), [nested]: value };
    else result[key] = value;
  }
  return result;
}
