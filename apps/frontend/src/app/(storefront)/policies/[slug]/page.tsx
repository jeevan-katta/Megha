import type { Metadata } from 'next';
import { Information } from '@/features/content/information-page';
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const name = slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return { title: name + (name.endsWith('Policy') ? '' : ' Policy') };
}
// Data for this page loads in the browser, so its server output holds no catalogue or customer
// data. Rendering each path once on first visit and caching it lets links fully prefetch it.
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}
export default function Page() {
  return <Information />;
}
