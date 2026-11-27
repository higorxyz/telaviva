import { expectNoViolations } from './axe';
import { expect, stubExternalHosts, test } from './fixtures';
import {
  cachedUrls,
  OFFLINE_TEXT,
  pickSeriesStatus,
  privateCachedUrls,
  progressCard,
  SERIES_PAGE,
  SERIES_SEASON_1,
  markButton,
  stubImagesForWorker,
  waitForWarmUp,
  waitForWorkerControl,
} from './offline-helpers';

// The specs that run the service worker (playwright.config.ts blocks it everywhere else; the last test blocks it too).
// e2e/offline-account.spec.ts covers the account side.
test.use({ serviceWorkers: 'allow' });

test.beforeEach(async ({ context }) => {
  await stubImagesForWorker(context);
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

test('/ and /minha-lista open offline even after tv-pages fills up and evicts their copies', async ({ page, context }) => {
  const inPagesCache = (path: string) =>
    page.evaluate(
      async (url) => Boolean(await (await caches.open('tv-pages')).match(url)),
      new URL(path, page.url()).href,
    );

  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await page.goto('/minha-lista');
  await expect(page.getByRole('heading', { level: 1, name: 'Minha lista' })).toBeVisible();
  // Both pages are network first while online: their latest copy lands in tv-pages.
  await expect.poll(() => inPagesCache('/minha-lista')).toBe(true);
  await expect.poll(() => inPagesCache('/')).toBe(true);

  // 85 more pages (warm-ups, WARM_HEADER in src/sw/rules.ts) push past the 80-entry limit.
  await page.evaluate(() =>
    Promise.all(
      Array.from({ length: 85 }, (_, i) =>
        fetch(`/filmes?n=${i}`, { headers: { 'X-TelaViva-Warm': '1', Accept: 'text/html' } }),
      ),
    ),
  );
  await expect.poll(() => inPagesCache('/minha-lista'), { timeout: 20_000 }).toBe(false);
  await expect.poll(() => inPagesCache('/'), { timeout: 20_000 }).toBe(false);

  await context.setOffline(true);
  await page.goto('/minha-lista');
  await expect(page.getByRole('heading', { level: 1, name: 'Minha lista' })).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Sem conexão' })).toHaveCount(0);
});

test('offline the indicator shows; a link to a page not saved waits, says so after 1.5 s and opens when back online', async ({
  page,
  context,
}) => {
  const offlineText = page.getByText(OFFLINE_TEXT);
  const pendingText = page.getByText('Esta página abre quando a internet voltar.');
  await page.goto('/filmes');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await expect(page.getByRole('heading', { level: 1, name: 'Filmes em cartaz e além' })).toBeVisible();
  await expect(offlineText).toHaveCount(0);

  await context.setOffline(true);
  await expect(offlineText).toBeVisible();
  await expectNoViolations(page);

  // A title page this device never opened nor prefetched (below the fold until now; one prefetched while online would
  // render from the router's memory): the router keeps the navigation pending instead of failing.
  const title = page.locator('main a[href^="/filme/"]').last();
  const href = (await title.getAttribute('href'))!;
  await title.click();
  await expect(pendingText).toHaveCount(0);
  await expect(pendingText).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ver minha lista' })).toHaveAttribute('href', '/minha-lista');
  await expect(page).toHaveURL('/filmes');

  await context.setOffline(false);
  await expect(page).toHaveURL(href);
  await expect(page.getByRole('heading', { level: 1, name: 'Filmes em cartaz e além' })).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(offlineText).toHaveCount(0);
  await expect(pendingText).toHaveCount(0);
});

test('the subway case: a series being watched is saved in the background, opens offline from the list and takes the next mark', async ({
  page,
  context,
}) => {
  // Another tab of this browser starts watching the series (T1E1 seen); this tab never opens the series page online.
  const setup = await context.newPage();
  await stubExternalHosts(setup);
  await setup.goto(SERIES_SEASON_1);
  await pickSeriesStatus(setup, 'Assistindo');
  await markButton(setup, 1).click();
  await expect(progressCard(setup)).toContainText('Próximo: T1E2');
  await setup.close();

  await page.goto('/minha-lista');
  const series = page.getByRole('tabpanel').getByRole('link', { name: /^Game of Thrones/ });
  await expect(series).toBeVisible();
  // Warm-ups need a controlling worker; then the page, season 1 (of T1E2) and the one after it get saved.
  await waitForWorkerControl(page);
  await waitForWarmUp(page, [1, 2]);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Minha lista' })).toBeVisible();
  await expect(page.getByText(OFFLINE_TEXT)).toBeVisible();

  // Tapped inside the app: the RSC request fails offline, the worker answers with the saved document and Next loads
  // the page in full from it.
  await series.click();
  await expect(page).toHaveURL(SERIES_PAGE);
  await expect(page.getByRole('heading', { level: 1, name: 'Game of Thrones' })).toBeVisible();
  const card = progressCard(page);
  // The episode name comes from the saved season.
  await expect(card).toContainText('Próximo: T1E2 · A Estrada Real');
  await card.getByRole('button', { name: 'Marcar como visto' }).click();
  await expect(card).toContainText('Próximo: T1E3');

  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Game of Thrones' })).toBeVisible();
  await expect(card).toContainText('Próximo: T1E3 · Lorde Snow');
  expect(await privateCachedUrls(page)).toEqual([]);
});

test.describe('with the worker blocked', () => {
  test.use({ serviceWorkers: 'block' });

  test('a registration that fails raises no page error', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/', { waitUntil: 'load' });
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await page.waitForTimeout(1500); // negative assertion: registration runs after load
    expect(errors).toEqual([]);
  });
});
