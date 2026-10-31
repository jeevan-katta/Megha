import { Router } from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { parseShiprocketDate } from '../../integrations/shiprocket/shiprocket.provider';
import type { TrackingUpdate } from '../../integrations/shiprocket/shipping.interface';
import { DomainError } from '../../shared/errors/domain-error';
import { Shipment } from '../shipments/shipment.model';
import { applyTracking } from '../shipments/tracking.service';
import { Event } from './webhook-event.model';

const scan = z
  .object({
    date: z.string().optional(),
    status: z.string().optional(),
    activity: z.string().optional(),
    location: z.string().optional(),
    'sr-status-label': z.string().optional(),
  })
  .passthrough();
const payload = z
  .object({
    awb: z.union([z.string(), z.number()]).transform(String),
    current_status: z.string().default(''),
    shipment_status: z.string().optional(),
    current_timestamp: z.string().optional(),
    etd: z.string().nullable().optional(),
    scans: z.array(scan).default([]),
  })
  .passthrough();

function authorised(supplied: string) {
  const expected = process.env.SHIPROCKET_WEBHOOK_TOKEN;
  if (!expected || !supplied) return false;
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Courier tracking updates. Verified by the shared token, deduplicated by content fingerprint,
 * then applied through the same pipeline as manual syncs. Always answers quickly with 2xx once
 * authenticated, so the provider does not retry or disable the hook.
 */
export const shiprocketWebhookRoutes = Router();
shiprocketWebhookRoutes.post('/', async (req, res) => {
  if (!process.env.SHIPROCKET_WEBHOOK_TOKEN)
    throw new DomainError('WEBHOOK_NOT_CONFIGURED', 'Webhook is not configured.', 503);
  if (!authorised(req.get('x-api-key') ?? ''))
    throw new DomainError('INVALID_SIGNATURE', 'Invalid webhook token.', 401);
  const parsed = payload.safeParse(req.body);
  if (!parsed.success) {
    res.json({ data: { received: true, ignored: 'unrecognised payload' } });
    return;
  }
  const body = parsed.data;
  const fingerprint = createHash('sha256')
    .update(JSON.stringify([body.awb, body.current_status, body.current_timestamp, body.scans]))
    .digest('hex');
  const key = 'shiprocket:' + fingerprint;
  const inserted = await Event.updateOne(
    { key },
    {
      $setOnInsert: {
        key,
        provider: 'shiprocket',
        event: body.current_status,
        bodyHash: fingerprint,
        processed: false,
      },
    },
    { upsert: true },
  ).catch((error) => {
    if ((error as { code?: number }).code === 11000) return { upsertedCount: 0 };
    throw error;
  });
  const event = await Event.findOne({ key });
  if (!inserted.upsertedCount && event?.processed) {
    res.json({ data: { received: true, duplicate: true } });
    return;
  }
  const shipment = await Shipment.findOne({ awb: body.awb }).sort({ createdAt: -1 }).lean();
  if (!shipment) {
    await Event.updateOne({ key }, { $set: { processed: true, processedAt: new Date() } });
    res.json({ data: { received: true, ignored: 'unknown AWB' } });
    return;
  }
  const updates: TrackingUpdate[] = [];
  for (const entry of body.scans) {
    const at = parseShiprocketDate(entry.date);
    if (!at) continue;
    updates.push({
      providerStatus: entry['sr-status-label'] || entry.status || entry.activity || '',
      activity: entry.activity ?? '',
      location: entry.location ?? '',
      at,
    });
  }
  const currentAt = parseShiprocketDate(body.current_timestamp);
  if (
    body.current_status &&
    currentAt &&
    !updates.some((u) => u.at.getTime() === currentAt.getTime())
  )
    updates.push({
      providerStatus: body.current_status,
      activity: body.current_status,
      location: '',
      at: currentAt,
    });
  await applyTracking(String(shipment._id), updates, 'webhook', {
    expectedDelivery: parseShiprocketDate(body.etd),
  });
  await Event.updateOne(
    { key },
    { $set: { processed: true, processedAt: new Date(), orderId: shipment.orderId } },
  );
  res.json({ data: { received: true } });
});
