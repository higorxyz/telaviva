import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { BrowserContext, Locator, Page } from '@playwright/test';
import { expect } from './fixtures';

/*
 * Shared by the specs that run the service worker (e2e/offline.spec.ts, e2e/offline-account.spec.ts). Every wait here
 * is on a real condition (the worker in control, an entry in a cache), never on time.
 */

const poster = readFileSync(path.join(process.cwd(), 'e2e', 'assets', 'poster.jpg'));

/** The series every offline scenario follows, and the URL the app links to (what the warm-up saves). */
export const SERIES_PAGE = '/serie/1399-game-of-thrones';
/** The same page on season 1: the mock serves season-1 episodes for every season (see library.spec.ts). */
export const SERIES_SEASON_1 = `${SERIES_PAGE}?temporada=1`;
export const SERIES_ID = 1399;

export const OFFLINE_TEXT = 'Sem conexão. Suas ações serão enviadas quando a internet voltar.';
export const SYNCED_TEXT = 'Tudo sincronizado.';

/**
 * The worker fetches TMDb images itself, in CORS mode: the stub sits on the context (page routes miss the worker's
 * requests) and answers with the CDN's CORS header.
 */
export async function stubImagesForWorker(context: BrowserContext): Promise<void> {
  await context.route(/^https:\/\/(image\.tmdb\.org|i\.ytimg\.com)\//, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/jpeg',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: poster,
    }),
  );
}

/** Every URL in every cache the page's origin holds. */
export const cachedUrls = (page: Page) =>
  page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) {
      for (const request of await (await caches.open(name)).keys()) urls.push(request.url);
    }
    return urls;
  });

/** The cached URLs under the private prefixes (spec §4: never in the worker's caches). */
export async function privateCachedUrls(page: Page): Promise<string[]> {
  return (await cachedUrls(page)).filter((url) => /^\/api\/(library|account|auth)/.test(new URL(url).pathname));
}

/** True when `cacheName` holds `path` (resolved against the page's origin). */
export const inCache = (page: Page, cacheName: string, path: string) =>
  page.evaluate(
    async ([name, url]) => Boolean(await (await caches.open(name)).match(url)),
    [cacheName, new URL(path, page.url()).href] as const,
  );

const hasController = (page: Page) => page.evaluate(() => Boolean(navigator.serviceWorker.controller));

/**
 * Waits until the worker controls the page: once it is active (`ready`), a page it has not claimed yet is reloaded once,
 * and that load goes through it.
 */
export async function waitForWorkerControl(page: Page): Promise<void> {
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  if (!(await hasController(page))) await page.reload();
  await expect.poll(() => hasController(page)).toBe(true);
}

/**
 * Waits for the background save of a series being watched (src/features/offline/useWarmWatching.ts): its page in
 * `tv-pages` and the given seasons in `tv-catalog-api`. Run under a controlling worker: warm-ups never run without one.
 */
export async function waitForWarmUp(page: Page, seasons: number[]): Promise<void> {
  // Several hops (the progress query, then a server render per page) on a server shared by six workers: more room
  // than the default, still no fixed wait (as LANDING in auth-helpers.ts).
  const generous = { timeout: 30_000 };
  await expect.poll(() => inCache(page, 'tv-pages', SERIES_PAGE), generous).toBe(true);
  for (const n of seasons) {
    await expect.poll(() => inCache(page, 'tv-catalog-api', `/api/tv/${SERIES_ID}/season/${n}`), generous).toBe(true);
  }
}

/** The status button of a series page and the panel it opens. */
export async function pickSeriesStatus(page: Page, status: 'Quero ver' | 'Assistindo' | 'Assistido'): Promise<void> {
  await page.getByRole('button', { name: /^(Adicionar à lista|Quero ver|Assistindo|Assistido)$/ }).click();
  await page.getByRole('group', { name: 'Status na sua lista' }).getByRole('button', { name: status, exact: true }).click();
  await expect(page.getByRole('button', { name: status, exact: true })).toBeVisible();
}

/** "Remover da lista" from the status panel of a series page. */
export async function removeSeries(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^(Quero ver|Assistindo|Assistido)$/ }).click();
  await page.getByRole('group', { name: 'Status na sua lista' }).getByRole('button', { name: 'Remover da lista' }).click();
  await expect(page.getByRole('button', { name: 'Adicionar à lista', exact: true })).toBeVisible();
}

/** One episode row of the season shown. */
export const episode = (page: Page, n: number): Locator =>
  page.locator('li').filter({ has: page.getByRole('heading', { name: new RegExp(`^E${n} · `) }) });

export const markButton = (page: Page, n: number) => episode(page, n).getByRole('button', { name: 'Marcar como visto' });
export const seenButton = (page: Page, n: number) => episode(page, n).getByRole('button', { name: 'Visto', exact: true });

export const progressCard = (page: Page) => page.getByRole('region', { name: 'Seu progresso' });
