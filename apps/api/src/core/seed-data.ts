const cats = [
  'Washing Machine Parts',
  'Hydro Extractor Parts',
  'Dryer Parts',
  'Industrial Iron Parts',
  'Boiler & Steam Parts',
  'Electrical & Control Parts',
  'Belts, Springs & Mechanical',
];
export const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
export const categories = cats.map((name, i) => ({
  name,
  slug: slug(name),
  image: '/assets/category-' + i + '.webp',
}));
const names = [
  'Pressure Switch',
  'Solenoid Valve',
  'V-Belt',
  'Heating Element',
  'Timer',
  'NRV (Non Return Valve)',
  'Drain Pump',
  'Door Lock Switch',
  'Thermostat',
  'Steam Gauge',
  'Hydro Spring',
  'Control Switch',
];
const prices = [1250, 1480, 320, 950, 1100, 450, 2800, 1250, 650, 800, 750, 480];
export const products = names.map((name, i) => ({
  name,
  slug: slug(name),
  sku: 'DEV-MGL-' + String(i + 1).padStart(3, '0'),
  partNumber: 'Reference ' + String(i + 1).padStart(3, '0'),
  category: categories[[0, 5, 6, 3, 5, 4, 0, 0, 2, 4, 1, 5][i]].slug,
  image: '/assets/part-' + (i % 6) + '.webp',
  description:
    name +
    ' for industrial laundry equipment. Confirm the exact specification and machine fit with our technical team before ordering.',
  price: prices[i] * 100,
  gstRate: 18,
  stock: 25,
  reserved: 0,
  threshold: 5,
  active: true,
  featured: i < 6,
  keywords: [name.toLowerCase(), i === 2 ? 'drive belt' : 'laundry spare'],
  specifications: [],
  developmentOnly: true,
}));
export const machines = [
  { name: 'Washer Extractor (Soft Mount)', capacity: '15 – 100 kg', category: 'washer-extractors' },
  {
    name: 'Washing Machine (Vertical / Front Loading)',
    capacity: '20 – 100 kg',
    category: 'washing-machines',
  },
  {
    name: 'Hydro Extractor (Direct Drive)',
    capacity: '7.5 – 100 kg',
    category: 'hydro-extractors',
  },
  { name: 'Tumble Dryer', capacity: '15 – 120 kg', category: 'tumble-dryers' },
].map((m, i) => ({
  ...m,
  slug: slug(m.name),
  image: '/assets/machine-' + i + '.webp',
  description:
    'Explore ' +
    m.name.toLowerCase() +
    ' for your laundry operation. Request a quotation for model selection, utility requirements and installation details.',
  specifications: [{ label: 'Capacity range (catalogue)', value: m.capacity }],
  active: true,
}));
export const services = [
  [
    'Installation & Commissioning',
    'Expert installation and commissioning for your laundry equipment.',
  ],
  ['Machine Repair & Service', 'On-site and workshop support for your machines.'],
  ['Annual Maintenance Contract (AMC)', 'Plan regular maintenance for your laundry operation.'],
  [
    'Comprehensive Maintenance Contract (CMC)',
    'Discuss comprehensive care and long-term equipment reliability.',
  ],
].map(([name, description], i) => ({
  name,
  description,
  slug: slug(name),
  image: '/assets/service-' + i + '.webp',
}));
