import { createHmac, timingSafeEqual } from 'node:crypto';
export function validSignature(body: string | Buffer, signature: string, secret: string): boolean {
  if (!secret || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac('sha256', secret).update(body).digest();
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}
