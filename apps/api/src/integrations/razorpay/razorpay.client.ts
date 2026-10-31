import { DomainError } from '../../shared/errors/domain-error';

export async function razorpay<T>(endpoint: string, body?: unknown): Promise<T> {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET)
    throw new DomainError(
      'PAYMENT_NOT_CONFIGURED',
      'Razorpay credentials have not been configured.',
      503,
    );
  const auth = Buffer.from(
    process.env.RAZORPAY_KEY_ID + ':' + process.env.RAZORPAY_KEY_SECRET,
  ).toString('base64');
  const r = await fetch('https://api.razorpay.com/v1/' + endpoint, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: 'Basic ' + auth, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok)
    throw new DomainError(
      'PAYMENT_PROVIDER_ERROR',
      'Payment provider is unavailable. Please retry.',
      502,
    );
  return r.json() as Promise<T>;
}
