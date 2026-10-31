import { roles } from '@megha/constants';
import { z } from 'zod';
const id = z.string().regex(/^[a-f0-9]{24}$/);
const name = z.string().trim().min(2).max(200);
const slug = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(150);
const image = z
  .string()
  .max(1000)
  .refine(
    (value) =>
      value.startsWith('/assets/') ||
      /^\/api\/v1\/media\/[a-f0-9]{24}$/.test(value) ||
      /^https:\/\//.test(value),
    'Use an uploaded image, asset path or HTTPS image URL',
  );
const specifications = z
  .array(z.object({ label: name, value: z.string().min(1).max(500) }))
  .max(40)
  .default([]);
export const adminProductSchema = z
  .object({
    name,
    slug,
    sku: z.string().trim().min(2).max(100),
    partNumber: z.string().max(100).default(''),
    category: slug,
    image,
    description: z.string().max(10000).default(''),
    price: z.number().int().min(1).max(100000000),
    gstRate: z.number().min(0).max(100),
    threshold: z.number().int().min(0).max(100000).default(5),
    active: z.boolean().default(true),
    featured: z.boolean().default(false),
    developmentOnly: z.boolean().default(true),
    keywords: z.array(z.string().max(100)).max(40).default([]),
    specifications,
    // Shipping weight (kg) and packed dimensions (cm) used for courier rates.
    weight: z.number().min(0).max(1000).optional(),
    length: z.number().min(0).max(500).optional(),
    breadth: z.number().min(0).max(500).optional(),
    height: z.number().min(0).max(500).optional(),
  })
  .strict();
export const adminCategorySchema = z.object({ name, slug, image }).strict();
export const adminMachineSchema = z
  .object({
    name,
    slug,
    image,
    category: slug,
    capacity: z.string().min(1).max(100),
    description: z.string().max(10000).default(''),
    active: z.boolean().default(true),
    specifications,
  })
  .strict();
export const machineModelSchema = z
  .object({
    title: name,
    description: z.string().max(10000).default(''),
    status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
    data: z
      .object({
        machineId: id,
        manufacturer: z.string().max(200),
        modelNumber: z.string().min(1).max(100),
      })
      .strict(),
  })
  .strict();
export const compatibilitySchema = z
  .object({
    machineModelId: id,
    productId: id,
    verified: z.boolean().default(false),
    notes: z.string().max(2000).default(''),
  })
  .strict();
export const staffCreateSchema = z
  .object({
    name,
    email: z.string().email().toLowerCase(),
    phone: z.string().max(30).default(''),
    role: z.enum(roles),
    password: z.string().min(12).max(128),
    active: z.boolean().default(true),
  })
  .strict();
export const staffUpdateSchema = staffCreateSchema.omit({ password: true }).partial().strict();
export const stockAdjustmentSchema = z
  .object({
    quantity: z
      .number()
      .int()
      .min(-100000)
      .max(100000)
      .refine((value) => value !== 0),
    reason: z.string().trim().min(5).max(500),
    type: z.enum(['GOODS_RECEIVED', 'DAMAGED', 'MANUAL_ADJUSTMENT']).default('MANUAL_ADJUSTMENT'),
    idempotencyKey: z.string().uuid(),
  })
  .strict();
export const adminQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  q: z.string().trim().max(100).default(''),
  status: z.string().max(40).default(''),
  /** Named operational filter, e.g. orders 'ready-to-ship' or shipments 'label-ready'. */
  view: z.string().max(40).default(''),
  sort: z.enum(['newest', 'oldest', 'name']).default('newest'),
});
export type AdminQuery = z.infer<typeof adminQuerySchema>;
export const dashboardQuerySchema = z.object({
  range: z.enum(['7d', '30d', '90d', '12m']).default('30d'),
});
export const contentSchema = z
  .object({
    title: name,
    description: z.string().max(20000).default(''),
    status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('DRAFT'),
    data: z
      .object({
        slug,
        section: z.enum(['resource', 'faq', 'policy', 'banner']).default('resource'),
      })
      .strict(),
  })
  .strict();
export const settingSchema = z
  .object({
    title: name,
    description: z.string().max(2000).default(''),
    status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
    data: z
      .object({
        key: z.enum(['support_phone', 'support_email', 'business_address', 'announcement']),
        value: z.string().max(2000),
      })
      .strict(),
  })
  .strict();

/** Final packed parcel, entered by the warehouse before any courier is requested. */
export const packageSchema = z
  .object({
    weight: z.number().min(0.05).max(500),
    length: z.number().min(1).max(300),
    breadth: z.number().min(1).max(300),
    height: z.number().min(1).max(300),
    count: z.number().int().min(1).max(50).default(1),
    notes: z.string().trim().max(1000).default(''),
  })
  .strict();
export const courierSchema = z
  .object({ courierId: z.number().int().positive().optional() })
  .strict();
export const reasonSchema = z.object({ reason: z.string().trim().min(5).max(1000) }).strict();
export const refundSchema = z
  .object({
    /** Paise; omitted means the full refundable balance. */
    amount: z.number().int().min(100).optional(),
    reason: z.string().trim().min(5).max(500),
    idempotencyKey: z.string().uuid(),
  })
  .strict();
/** Inspection of a parcel returned to origin: what happens to the goods, and whether to refund. */
export const rtoInspectionSchema = z
  .object({
    goods: z.enum(['RESTOCK', 'DAMAGED', 'RESHIP', 'NO_ACTION']),
    refund: z.boolean().default(false),
    notes: z.string().trim().max(1000).default(''),
    idempotencyKey: z.string().uuid(),
  })
  .strict()
  .refine((value) => !(value.refund && value.goods === 'RESHIP'), {
    message: 'A reshipped order cannot also be refunded.',
  });
export const ndrActionSchema = z
  .object({
    action: z.enum(['CONTACTED_CUSTOMER', 'UPDATED_INSTRUCTIONS', 'RETRY_REQUESTED', 'ESCALATED']),
    notes: z.string().trim().min(3).max(1000),
  })
  .strict();
export const returnDecisionSchema = z
  .object({
    decision: z.enum(['APPROVE', 'REJECT']),
    notes: z.string().trim().max(1000).default(''),
  })
  .strict();
export const returnReceiptSchema = z
  .object({
    items: z
      .array(
        z.object({
          productId: z.string().min(1).max(64),
          quantity: z.number().int().min(1),
          condition: z.enum(['RESTOCK', 'DAMAGED']),
        }),
      )
      .min(1)
      .max(100),
    notes: z.string().trim().max(1000).default(''),
  })
  .strict();
