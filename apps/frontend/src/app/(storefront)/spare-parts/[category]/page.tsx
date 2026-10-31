import { serverCatalogue } from '@/lib/server-api';
import type { Metadata } from 'next';
import { CatalogueBoundary } from '@/components/layout/catalogue-boundary';
import { CataloguePage } from '@/features/catalogue/catalogue-page';
export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const item = (await serverCatalogue())?.categories.find((c) => c.slug === category);
  return {
    title: /parts$/i.test(item?.name ?? '')
      ? item!.name
      : (item?.name ?? 'Laundry') + ' Spare Parts',
    description:
      'Genuine ' + (item?.name ?? 'laundry') + ' spare parts from Megha Laundry Equipment.',
  };
}
// Data for this page loads in the browser, so its server output holds no catalogue or customer
// data. Rendering each path once on first visit and caching it lets links fully prefetch it.
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}
export default function Page() {
  return (
    <CatalogueBoundary>
      <CataloguePage />
    </CatalogueBoundary>
  );
}
