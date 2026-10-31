import type { Metadata } from 'next';
import { OrderPage } from '@/features/orders/order-page';
export const metadata: Metadata = {
  title: 'Track Your Order',
  robots: { index: false, follow: true },
};
// Data for this page loads in the browser, so its server output holds no catalogue or customer
// data. Rendering each path once on first visit and caching it lets links fully prefetch it.
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}
export default function Page() {
  return <OrderPage />;
}
