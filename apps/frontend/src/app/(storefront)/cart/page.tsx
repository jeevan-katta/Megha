import type { Metadata } from 'next';
import { CatalogueBoundary } from '@/components/layout/catalogue-boundary';
import { Cart } from '@/features/cart/cart-page';
export const metadata: Metadata = { title: 'Your Cart', robots: { index: false, follow: true } };
export default function Page() {
  return (
    <CatalogueBoundary>
      <Cart />
    </CatalogueBoundary>
  );
}
