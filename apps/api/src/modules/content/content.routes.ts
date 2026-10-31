import { Router } from 'express';
import { z } from 'zod';
import { Entity } from '../records/record.model';
const section = z.enum(['resource', 'faq', 'policy', 'banner']);
const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(150);
export const contentRoutes = Router();
contentRoutes.get('/:section/:slug', async (req, res) => {
  const record = await Entity.findOne({
    kind: 'content',
    status: 'PUBLISHED',
    'data.section': section.parse(req.params.section),
    'data.slug': slug.parse(req.params.slug),
  })
    .select('title description')
    .lean();
  res.json({ data: record });
});
