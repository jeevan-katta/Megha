import { z } from 'zod';
export const adminModule = z.enum([
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
  'reports',
]);
export type AdminModule = z.infer<typeof adminModule>;
export const statusPatch = z.object({ status: z.string().min(2).max(40) }).strict();
export const recordPatch = z
  .object({
    status: z.string().max(40).optional(),
    description: z.string().max(10000).optional(),
    data: z
      .object({
        publicResponse: z.string().max(5000).optional(),
        internalNotes: z.string().max(10000).optional(),
        technicianId: z
          .string()
          .regex(/^[a-f0-9]{24}$/)
          .optional(),
        priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
        scheduledAt: z.string().datetime().optional(),
        validUntil: z.string().datetime().optional(),
        identifiedProductId: z
          .string()
          .regex(/^[a-f0-9]{24}$/)
          .optional(),
        quoteLines: z
          .array(
            z
              .object({
                description: z.string().min(2).max(500),
                quantity: z.number().int().min(1).max(10000),
                unitPrice: z.number().int().min(0).max(100000000),
                gstRate: z.number().min(0).max(100),
              })
              .strict(),
          )
          .max(100)
          .optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
