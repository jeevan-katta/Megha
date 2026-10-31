import type { ClientSession } from 'mongoose';
import { config } from '../../config';
import { queueEmail } from '../email/email.service';
import { Entity } from '../records/record.model';
import { User } from '../users/user.model';

/** Notifications keyed "order:<number>:…" (or carrying an orderId) link to that order. */
function orderLink(key: string, data: Record<string, unknown>) {
  const ref = typeof data.orderId === 'string' ? data.orderId : key.match(/^order:([^:]+):/)?.[1];
  return ref ? config.siteUrl + '/track/' + encodeURIComponent(ref) : config.siteUrl + '/account';
}

/**
 * Records a customer notification once per event key and emails it once. Both are written with
 * the caller's session, so nothing is recorded or sent if the change is rolled back.
 */
export async function notifyOnce(
  userId: string | null | undefined,
  key: string,
  title: string,
  description: string,
  data: Record<string, unknown> = {},
  session?: ClientSession,
) {
  if (!userId) return;
  let created = false;
  try {
    const result = await Entity.updateOne(
      { kind: 'notifications', ownerId: userId, number: key },
      {
        $setOnInsert: {
          kind: 'notifications',
          ownerId: userId,
          number: key,
          title,
          description,
          status: 'UNREAD',
          data,
        },
      },
      { upsert: true, session },
    );
    created = result.upsertedCount > 0;
  } catch (error) {
    // A concurrent duplicate lost the race to the unique index: already notified.
    if ((error as { code?: number }).code !== 11000) throw error;
  }
  if (!created) return;
  const user = await User.findById(userId, { email: 1, name: 1 }, { session }).lean();
  await queueEmail(
    {
      key: 'notification:' + userId + ':' + key,
      to: user?.email,
      subject: title,
      heading: title,
      lines: [`Hello ${user?.name ?? 'there'},`, description],
      action: { label: 'View your order', url: orderLink(key, data) },
    },
    session,
  );
}
