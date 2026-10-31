import { siteUrl } from '@/lib/server-api';
import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Private or per-visitor pages have nothing to index.
      disallow: [
        '/admin',
        '/account',
        '/cart',
        '/checkout',
        '/order/',
        '/track/',
        '/search',
        '/reset-password',
      ],
    },
    sitemap: siteUrl + '/sitemap.xml',
  };
}
