// One-time migration: quotation requests now live in the single "enquiries" workflow.
// Safe to re-run; each moved record keeps its original kind and status in data.mergedFrom.
import dotenv from 'dotenv';
import mongoose from 'mongoose';
dotenv.config({ path: 'apps/api/.env', quiet: true });
const { connectDatabase } = await import('../apps/api/src/database/mongoose');
const { Entity } = await import('../apps/api/src/modules/records/record.model');

const quoteStatus: Record<string, string> = {
  REQUESTED: 'NEW',
  UNDER_REVIEW: 'CONTACTED',
  PREPARED: 'QUOTE_PREPARED',
  SENT: 'QUOTE_SENT',
  CUSTOMER_REVIEW: 'NEGOTIATION',
};
const enquiryStatus: Record<string, string> = { QUALIFIED: 'CONTACTED', QUOTED: 'QUOTE_SENT' };

try {
  await connectDatabase();
  let moved = 0;
  for (const record of await Entity.find({ kind: 'quotes' })) {
    const status = quoteStatus[record.status ?? ''] ?? record.status ?? 'NEW';
    record.data = { ...record.data, mergedFrom: { kind: 'quotes', status: record.status } };
    record.kind = 'enquiries';
    record.status = status;
    await record.save();
    moved++;
  }
  let renamed = 0;
  for (const [from, to] of Object.entries(enquiryStatus)) {
    const result = await Entity.updateMany(
      { kind: 'enquiries', status: from },
      { $set: { status: to, 'data.mergedFrom': { kind: 'enquiries', status: from } } },
    );
    renamed += result.modifiedCount;
  }
  console.log(`Quotes moved into enquiries: ${moved}. Enquiry statuses renamed: ${renamed}.`);
} finally {
  await mongoose.disconnect();
}
