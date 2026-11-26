import { APP_URL } from './e2e-env';
import { expect, test } from './fixtures';

/* The security headers (next.config.ts), robots.txt and sitemap.xml, as the production server sends them. */

test('the home page is sent with the security headers', async ({ request }) => {
  const response = await request.get('/');
  expect(response.status()).toBe(200);
  expect(response.headers()).toMatchObject({
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'permissions-policy': 'camera=(), microphone=(), geolocation=()',
    'x-frame-options': 'DENY',
  });
});

test('the service worker keeps its root scope header', async ({ request }) => {
  const response = await request.get('/serwist/sw.js');
  expect(response.status()).toBe(200);
  expect(response.headers()['service-worker-allowed']).toBe('/');
  expect(response.headers()['x-content-type-options']).toBe('nosniff');
});

test('robots.txt keeps crawlers off the account, sign-in, API and worker paths and points to the sitemap', async ({
  request,
}) => {
  const response = await request.get('/robots.txt');
  expect(response.status()).toBe(200);
  const body = await response.text();
  expect(body).toContain('User-Agent: *');
  expect(body).toContain('Allow: /');
  for (const path of ['/conta', '/entrar', '/api/', '/serwist/']) expect(body).toContain(`Disallow: ${path}`);
  expect(body).toContain(`Sitemap: ${APP_URL}/sitemap.xml`);
});

test('sitemap.xml lists the hubs, the catalog lists and the genre pages, and no account page', async ({ request }) => {
  const response = await request.get('/sitemap.xml');
  expect(response.status()).toBe(200);
  const locs = [...(await response.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  for (const path of ['', '/filmes', '/series', '/descobrir', '/generos', '/filmes/em-alta', '/series/em-alta']) {
    expect(locs).toContain(`${APP_URL}${path}`);
  }
  expect(locs.some((loc) => loc.startsWith(`${APP_URL}/genero/filme/`))).toBe(true);
  expect(locs.some((loc) => loc.startsWith(`${APP_URL}/genero/serie/`))).toBe(true);
  expect(locs.filter((loc) => /\/(conta|entrar|minha-lista|buscar)\b/.test(loc))).toEqual([]);
});
