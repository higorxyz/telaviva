import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';

/**
 * Everything is open to crawlers but the API and the service worker files. The account and sign-in pages stay open
 * on purpose: they are `noindex`, and a crawler must be allowed to fetch them to see that (a disallowed URL can still
 * be indexed from links, without its content). The sitemap lives on the canonical site URL.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/serwist/'] },
    sitemap: `${new URL(env.SITE_URL).origin}/sitemap.xml`,
  };
}
