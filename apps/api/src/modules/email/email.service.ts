import mongoose, { type ClientSession } from 'mongoose';
import { emailProvider } from '../../integrations/email';
import { Email } from './email.model';
import { renderEmail } from './email.template';

const MAX_ATTEMPTS = 5;
const LOCK_MS = 5 * 60000;

/**
 * Queues an email once per key. Pass the caller's session so the email is only queued if the
 * change it describes is committed. Does nothing when email is disabled.
 */
export async function queueEmail(
  message: {
    key: string;
    to: string | null | undefined;
    subject: string;
    heading: string;
    lines: string[];
    action?: { label: string; url: string };
    sensitive?: boolean;
  },
  session?: ClientSession,
) {
  if (!emailProvider || !message.to) return;
  const { text, html } = renderEmail(message);
  try {
    await Email.updateOne(
      { key: message.key },
      {
        $setOnInsert: {
          key: message.key,
          to: message.to,
          subject: message.subject,
          text,
          html,
          sensitive: !!message.sensitive,
          status: 'PENDING',
        },
      },
      { upsert: true, session },
    );
  } catch (error) {
    // A concurrent duplicate lost the race to the unique key: already queued.
    if ((error as { code?: number }).code !== 11000) throw error;
  }
  deliverSoon();
}

/**
 * Sends queued emails. Each message is claimed with a short lock so overlapping runs never send
 * it twice; failures retry with backoff and stop after five attempts.
 */
export async function deliverEmails({ limit = 20 } = {}) {
  if (!emailProvider) return { sent: 0, failed: 0 };
  let sent = 0,
    failed = 0;
  for (let i = 0; i < limit; i++) {
    const now = new Date();
    const message = await Email.findOneAndUpdate(
      {
        status: { $in: ['PENDING', 'SENDING'] },
        attempts: { $lt: MAX_ATTEMPTS },
        $or: [
          { lockedUntil: { $exists: false } },
          { lockedUntil: null },
          { lockedUntil: { $lt: now } },
        ],
      },
      { $set: { status: 'SENDING', lockedUntil: new Date(now.getTime() + LOCK_MS) } },
      { sort: { createdAt: 1 }, new: true },
    );
    if (!message) break;
    try {
      await emailProvider.send({
        to: message.to,
        subject: message.subject,
        text: message.text ?? '',
        html: message.html ?? undefined,
      });
      await Email.updateOne(
        { _id: message._id },
        {
          $set: { status: 'SENT', sentAt: new Date() },
          $unset: {
            lockedUntil: 1,
            lastError: 1,
            ...(message.sensitive ? { text: 1, html: 1 } : {}),
          },
        },
      );
      sent++;
    } catch (error) {
      const attempts = (message.attempts ?? 0) + 1;
      await Email.updateOne(
        { _id: message._id },
        {
          $set: {
            status: attempts >= MAX_ATTEMPTS ? 'FAILED' : 'PENDING',
            attempts,
            lastError: (error as Error).message.slice(0, 300),
            // Back off: 2, 4, 6, 8 minutes.
            lockedUntil: new Date(Date.now() + attempts * 2 * 60000),
          },
        },
      );
      failed++;
    }
  }
  return { sent, failed };
}

let timer: NodeJS.Timeout | undefined;
/** Sends shortly after queueing (after the surrounding transaction has committed). */
function deliverSoon() {
  if (timer) return;
  timer = setTimeout(() => {
    timer = undefined;
    // The process may be shutting down; the next scheduled run sends anything left.
    if (mongoose.connection.readyState !== 1) return;
    deliverEmails().catch((error) => console.error('Email delivery failed', error));
  }, 1500);
  timer.unref();
}
