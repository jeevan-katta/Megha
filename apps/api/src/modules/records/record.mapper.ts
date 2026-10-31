import type { InferSchemaType } from 'mongoose';
import { Entity } from './record.model';
/** Customer responses never include arbitrary staff notes or private metadata. */
export function publicRecord(record: InferSchemaType<typeof Entity.schema> & { _id: unknown }) {
  const data: Record<string, unknown> = {};
  for (const key of [
    'company',
    'machine',
    'partNumber',
    'quantity',
    'location',
    'productId',
    'orderId',
    'publicResponse',
    'scheduledAt',
    'identifiedProductId',
    ...(record.kind === 'enquiries' &&
    ['QUOTE_SENT', 'NEGOTIATION', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED'].includes(
      record.status ?? '',
    )
      ? ['quoteLines', 'quoteTotals', 'validUntil']
      : []),
  ])
    if (record.data?.[key] !== undefined) data[key] = record.data[key];
  return {
    _id: String(record._id),
    kind: record.kind,
    number: record.number,
    title: record.title,
    status: record.status,
    description: record.description,
    createdAt: record.createdAt,
    data,
  };
}
