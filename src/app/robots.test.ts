import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function load(siteUrl?: string) {
  if (siteUrl !== undefined) vi.stubEnv('NEXT_PUBLIC_SITE_URL', siteUrl);
  vi.resetModules();
  return (await import('./robots')).default();
}

describe('robots', () => {
  it('lets every crawler in except the account, sign-in, API and service-worker paths', async () => {
    const robots = await load();
    expect(robots.rules).toEqual({
      userAgent: '*',
      allow: '/',
      disallow: ['/conta', '/entrar', '/api/', '/serwist/'],
    });
  });

  it('points to the sitemap on the default site URL', async () => {
    expect((await load('')).sitemap).toBe('https://telaviva.vercel.app/sitemap.xml');
  });

  it('points to the sitemap on the configured site URL', async () => {
    expect((await load('https://exemplo.dev')).sitemap).toBe('https://exemplo.dev/sitemap.xml');
  });
});
