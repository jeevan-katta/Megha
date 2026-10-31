import { z } from 'zod';
export const productQuery = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().max(100).optional(),
  sort: z.enum(['featured', 'price-asc', 'price-desc']).optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(24),
});
export const productPatch = z
  .object({
    name: z.string().trim().min(2).max(200).optional(),
    description: z.string().max(10000).optional(),
    price: z.number().int().min(0).max(100000000).optional(),
    active: z.boolean().optional(),
    featured: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'No update fields supplied');
