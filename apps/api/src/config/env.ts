import 'dotenv/config';
import { z } from 'zod';
const production = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;
const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  APP_MODE: z
    .enum(['development', 'production'])
    .default(production ? 'production' : 'development'),
  MONGODB_URI: z.string().startsWith('mongodb').default('mongodb://127.0.0.1:27017/megha_laundry'),
  FRONTEND_ORIGIN: z.string().default('http://127.0.0.1:3000,http://localhost:3000'),
  PAYMENT_PROVIDER: z
    .enum(['development', 'razorpay', 'disabled'])
    .default(production ? 'disabled' : 'development'),
  STORAGE_PROVIDER: z.enum(['local', 's3', 'disabled']).default(production ? 'disabled' : 'local'),
  LOCAL_UPLOAD_DIR: z.string().default('.local/uploads'),
  ENABLE_CHECKOUT: z.enum(['true', 'false']).default(production ? 'false' : 'true'),
  SHIPPING_PROVIDER: z
    .enum(['development', 'demo', 'shiprocket', 'disabled'])
    .default(production ? 'disabled' : 'development'),
  /** Used for rates when a product has no shipping weight recorded. */
  DEFAULT_ITEM_WEIGHT_KG: z.coerce.number().min(0.05).max(500).default(1),
  /** development writes emails to EMAIL_OUTBOX_DIR instead of sending them. */
  EMAIL_PROVIDER: z
    .enum(['development', 'smtp', 'disabled'])
    .default(production ? 'disabled' : 'development'),
  EMAIL_FROM: z.string().default('Megha Laundry Equipment <no-reply@megha.local>'),
  EMAIL_OUTBOX_DIR: z.string().default('.local/outbox'),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  /** Where new enquiry, service and Find My Spare alerts go; leave empty to skip them. */
  STAFF_ALERT_EMAIL: z.string().email().optional().or(z.literal('')),
  /** City/state lookup for PIN codes (India Post's public service); disabled skips it. */
  PINCODE_LOOKUP: z.enum(['india-post', 'disabled']).default('india-post'),
  /** Public storefront address used in email links. */
  SITE_URL: z.string().url().default('http://127.0.0.1:3000'),
});
const result = schema.safeParse(process.env);
if (!result.success)
  throw new Error(
    'Invalid environment fields: ' + result.error.issues.map((i) => i.path.join('.')).join(', '),
  );
const env = result.data;
if (production && env.APP_MODE !== 'production')
  throw new Error('Development fixtures are forbidden in production.');
if (process.env.VERCEL && /localhost|127\.0\.0\.1/.test(env.MONGODB_URI))
  throw new Error('Vercel requires a network-accessible MongoDB URI.');
if (production && env.STORAGE_PROVIDER === 'local')
  throw new Error('Local persistent storage is development-only.');
if (production && env.PAYMENT_PROVIDER === 'development')
  throw new Error('Simulated payments are development-only.');
if (production && env.SHIPPING_PROVIDER === 'development')
  throw new Error('Simulated shipping is development-only.');
// A hosted client demo may quote simulated delivery, but must never collect live money.
if (
  env.SHIPPING_PROVIDER === 'demo' &&
  (env.PAYMENT_PROVIDER !== 'razorpay' || !process.env.RAZORPAY_KEY_ID?.startsWith('rzp_test_'))
)
  throw new Error('Demo shipping requires Razorpay test credentials. Live payments are forbidden.');
if (production && env.EMAIL_PROVIDER === 'development')
  throw new Error('The development email outbox is development-only.');
if (
  env.EMAIL_PROVIDER === 'smtp' &&
  ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD'].some((key) => !process.env[key])
)
  throw new Error('SMTP email requires SMTP_HOST, SMTP_USER and SMTP_PASSWORD.');
if (
  env.SHIPPING_PROVIDER === 'shiprocket' &&
  [
    'SHIPROCKET_EMAIL',
    'SHIPROCKET_PASSWORD',
    'SHIPROCKET_PICKUP_LOCATION',
    'SHIPROCKET_PICKUP_PINCODE',
  ].some((key) => !process.env[key])
)
  throw new Error(
    'Shiprocket requires SHIPROCKET_EMAIL, SHIPROCKET_PASSWORD, SHIPROCKET_PICKUP_LOCATION and SHIPROCKET_PICKUP_PINCODE.',
  );
if (
  env.PAYMENT_PROVIDER === 'razorpay' &&
  (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET)
)
  throw new Error('Razorpay requires backend API credentials.');
if (
  env.APP_MODE === 'development' &&
  env.PAYMENT_PROVIDER === 'razorpay' &&
  !process.env.RAZORPAY_KEY_ID?.startsWith('rzp_test_')
)
  throw new Error('Local development requires Razorpay test credentials.');
export const config = Object.freeze({
  port: env.PORT,
  mongo: env.MONGODB_URI,
  production,
  development: env.APP_MODE === 'development',
  payment: env.PAYMENT_PROVIDER,
  testPayments:
    env.PAYMENT_PROVIDER === 'razorpay' && !!process.env.RAZORPAY_KEY_ID?.startsWith('rzp_test_'),
  storage: env.STORAGE_PROVIDER,
  origins: env.FRONTEND_ORIGIN.split(',').map((s) => new URL(s.trim()).origin),
  uploads: env.LOCAL_UPLOAD_DIR,
  checkoutEnabled: env.ENABLE_CHECKOUT === 'true',
  shipping: env.SHIPPING_PROVIDER,
  defaultItemWeightKg: env.DEFAULT_ITEM_WEIGHT_KG,
  email: env.EMAIL_PROVIDER,
  emailFrom: env.EMAIL_FROM,
  emailOutbox: env.EMAIL_OUTBOX_DIR,
  smtpPort: env.SMTP_PORT,
  staffAlertEmail: env.STAFF_ALERT_EMAIL || '',
  pincodeLookup: env.PINCODE_LOOKUP,
  siteUrl: env.SITE_URL.replace(/\/$/, ''),
});
