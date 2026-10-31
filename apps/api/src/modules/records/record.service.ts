import { personalRecordKinds, publicRequestKinds, writablePersonalKinds } from '@megha/constants';
import { requestSchema } from '@megha/validation';
import { z } from 'zod';
import { config } from '../../config';
import { queueEmail } from '../email/email.service';
import { publicRecord } from './record.mapper';
import { recordRepository } from './record.repository';
const personalSchema = z
  .object({
    title: z.string().trim().min(2).max(200),
    description: z.string().max(1000).optional(),
    data: z
      .object({
        productId: z.string().optional(),
        machineId: z.string().optional(),
        serialNumber: z.string().max(100).optional(),
      })
      .strict()
      .default({}),
  })
  .strict();
const requestNames: Record<string, string> = {
  enquiries: 'enquiry',
  'service-requests': 'service request',
  'find-my-spare': 'Find My Spare request',
};
export async function submitRequest(kind: unknown, input: unknown, userId?: string) {
  const type = z.enum(publicRequestKinds).parse(kind);
  const data = requestSchema.parse(input);
  const record = await recordRepository.createRequest(type, data, userId);
  const name = requestNames[type];
  const reference = record.number ?? String(record._id);
  // Acknowledge the customer and alert staff; each is sent once per request.
  await queueEmail({
    key: 'request:' + reference + ':received',
    to: data.email,
    subject: `We received your ${name} · ${reference}`,
    heading: `Thank you, we received your ${name}`,
    lines: [
      `Hello ${data.name},`,
      `Your reference is ${reference}. Our team will review it and get back to you shortly.`,
      `Subject: ${data.title}`,
    ],
    action: userId
      ? { label: 'Follow it in your account', url: config.siteUrl + '/account' }
      : undefined,
  });
  await queueEmail({
    key: 'request:' + reference + ':staff',
    to: config.staffAlertEmail,
    subject: `New ${name}: ${data.title} (${reference})`,
    heading: `New ${name} ${reference}`,
    lines: [
      `From: ${data.name} · ${data.email} · ${data.phone}`,
      ...(data.data.company ? [`Company: ${data.data.company}`] : []),
      `Subject: ${data.title}`,
      data.description,
    ],
    action: { label: 'Open in admin', url: config.siteUrl + '/admin/' + type },
  });
  return publicRecord(record);
}
export async function personalRecords(kind: unknown, userId: string) {
  return (await recordRepository.owned(z.enum(personalRecordKinds).parse(kind), userId)).map(
    publicRecord,
  );
}
export async function savePersonal(kind: unknown, input: unknown, userId: string) {
  return publicRecord(
    await recordRepository.createPersonal(
      z.enum(writablePersonalKinds).parse(kind),
      userId,
      personalSchema.parse(input),
    ),
  );
}
