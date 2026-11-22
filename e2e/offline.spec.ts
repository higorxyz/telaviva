import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { expectNoViolations } from './axe';
import { expect, test } from './fixtures';

// The one spec that runs the service worker (playwright.config.ts blocks it everywhere else).
test.use({ serviceWorkers: 'allow' });

const poster = readFileSync(path.join(process.cwd(), 'e2e', 'assets', 'poster.jpg'));

/** Every URL in every cache the page's origin holds. */
const cachedUrls = (page: Page) =>
  page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) {
      for (const request of await (await caches.open(name)).keys()) urls.push(request.url);
    }
    return urls;
  });

test.beforeEach(async ({ context }) => {
  // The worker fetches TMDb images itself, in CORS mode: the stub sits on the context (page routes miss the worker's
  // requests) and answers with the CDN's CORS header.
  await context.route(/^https:\/\/(image\.tmdb\.org|i\.ytimg\.com)\//, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/jpeg',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: poster,
    }),
  );
});

test('visited pages and the saved ones open offline; any other page shows "Sem conexão"', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  await page.goto('/filmes');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  // Loaded again under the worker, so this load passes through it and is stored.
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Filmes em cartaz e além' })).toBeVisible();
  expect(await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL)).toMatch(/\/serwist\/sw\.js$/);

  // Personal endpoints go through the worker untouched (asked while online, they must not be stored).
  await page.evaluate(() => Promise.all(['/api/auth/me', '/api/library', '/api/account/export'].map((url) => fetch(url))));

  await context.setOffline(true);

  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Filmes em cartaz e além' })).toBeVisible();

  await page.goto('/series');
  await expect(page.getByRole('heading', { level: 1, name: 'Sem conexão' })).toBeVisible();
  await expect(page.getByText('Você está sem internet e esta página ainda não foi salva neste aparelho.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tentar de novo' })).toBeVisible();
  const shortcuts = page.getByRole('navigation', { name: 'Atalhos' });
  await expect(shortcuts.getByRole('link', { name: 'Minha lista' })).toHaveAttribute('href', '/minha-lista');
  await expect(shortcuts.getByRole('link', { name: 'Início' })).toHaveAttribute('href', '/');
  await expectNoViolations(page);

  // Saved when the worker installed, never visited in this test. A soft navigation: its RSC request fails offline.
  await shortcuts.getByRole('link', { name: 'Minha lista' }).click();
  await expect(page).toHaveURL('/minha-lista');
  await expect(page.getByRole('heading', { level: 1, name: 'Minha lista' })).toBeVisible();

  const urls = await cachedUrls(page);
  expect(urls.some((url) => url.endsWith('/filmes'))).toBe(true);
  expect(urls.filter((url) => /\/api\/(library|auth|account)/.test(new URL(url).pathname))).toEqual([]);
});
