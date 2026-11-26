import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';

/**
 * Everything is open to crawlers but the account and sign-in pages (also `noindex`), the API and the service worker
 * files. The sitemap lives on the canonical site URL.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/conta', '/entrar', '/api/', '/serwist/'] },
    sitemap: `${new URL(env.SITE_URL).origin}/sitemap.xml`,
  };
}
