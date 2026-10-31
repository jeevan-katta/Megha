import type { Catalogue, Product } from '@megha/types';

const origin = (process.env.BACKEND_URL || 'http://127.0.0.1:5000').replace(/\/$/, '');
/** Public site address for canonical links and the sitemap. */
export const siteUrl = (process.env.SITE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');

/**
 * Public, cacheable reads for server rendering (titles, product pages, sitemap). Returns
 * `undefined` when the API is unreachable so the page still renders and loads data in the
 * browser, and `null` when the API answers 404.
 */
async function read<T>(path: string, revalidate = 300): Promise<T | null | undefined> {
  try {
    const response = await fetch(origin + '/api/v1' + path, {
      next: { revalidate },
      signal: AbortSignal.timeout(10000),
    });
    if (response.status === 404) return null;
    if (!response.ok) return undefined;
    return ((await response.json()) as { data: T }).data;
  } catch {
    return undefined;
  }
}
export const serverProduct = (slug: string) =>
  read<{ product: Product }>('/products/' + encodeURIComponent(slug)).then((result) =>
    result === null ? null : result?.product,
  );
export const serverCatalogue = () => read<Catalogue>('/catalogue');
export const plainText = (text = '', length = 160) =>
  text.replace(/\s+/g, ' ').trim().slice(0, length);
