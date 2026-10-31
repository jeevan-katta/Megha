import { Router } from 'express';
import { emailSchema } from '@megha/validation';
import { z } from 'zod';
import { rateLimit } from '../../middleware/rate-limit.middleware';
import { Entity } from '../records/record.model';
export const newsletterRoutes = Router();
newsletterRoutes.post('/', rateLimit('newsletter', 20, 15 * 60000), async (req, res) => {
  const { email } = z
    .object({
      email: emailSchema.transform((s) => s.toLowerCase()),
    })
    .strict()
    .parse(req.body);
  await Entity.updateOne(
    { kind: 'newsletter', email },
    { $setOnInsert: { status: 'SUBSCRIBED', data: { consentedAt: new Date() } } },
    { upsert: true },
  );
  res.json({ data: { message: 'Your subscription preference has been saved.' } });
});
