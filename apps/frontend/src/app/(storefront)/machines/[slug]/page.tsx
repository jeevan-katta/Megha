import { serverCatalogue, plainText } from '@/lib/server-api';
import type { Metadata } from 'next';
import { CatalogueBoundary } from '@/components/layout/catalogue-boundary';
import { Machines } from '@/features/machines/machines-page';
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const item = (await serverCatalogue())?.machines.find((m) => m.slug === slug);
  return item
    ? {
        title: item.name,
        description:
          plainText(item.description) ||
          item.name + ' from Megha Laundry Equipment, supplied by quotation.',
      }
    : { title: 'Laundry Machine' };
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
      <Machines />
    </CatalogueBoundary>
  );
}
