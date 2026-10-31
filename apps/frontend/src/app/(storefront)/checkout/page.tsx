import type { Metadata } from 'next';
import { Checkout } from '@/features/checkout/checkout-page';
export const metadata: Metadata = { title: 'Checkout', robots: { index: false, follow: true } };
export default function Page() {
  return <Checkout />;
}
