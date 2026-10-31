import { serverCatalogue, siteUrl } from '@/lib/server-api';
import type { MetadataRoute } from 'next';

// Rebuilt hourly from the public catalogue so new products appear without a deploy.
export const revalidate = 3600;
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const catalogue = await serverCatalogue();
  const pages = [
    '',
    '/spare-parts',
    '/machines',
    '/services',
    '/find-my-spare',
    '/bulk-quote',
    '/contact',
    '/about',
    '/faq',
    '/policies/shipping',
    '/policies/returns',
    '/policies/privacy',
    '/policies/terms',
  ];
  return [
    ...pages.map((path) => ({ url: siteUrl + path })),
    ...(catalogue?.categories ?? []).map((c) => ({ url: siteUrl + '/spare-parts/' + c.slug })),
    ...(catalogue?.products ?? []).map((p) => ({ url: siteUrl + '/product/' + p.slug })),
    ...(catalogue?.machines ?? []).map((m) => ({ url: siteUrl + '/machines/' + m.slug })),
    ...(catalogue?.services ?? []).map((s) => ({ url: siteUrl + '/services/' + s.slug })),
  ];
}
