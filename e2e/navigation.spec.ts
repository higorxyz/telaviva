import { expect, test } from './fixtures';

const TITLE_LINKS = 'section[aria-label] a[href^="/filme/"], section[aria-label] a[href^="/serie/"]';

test.describe('desktop', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop only');

  test('home has a featured h1, rails and no duplicated titles', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const rails = page.locator('section[id][aria-label]');
    await expect.poll(() => rails.count()).toBeGreaterThanOrEqual(6);

    const hrefs = await page.locator(TITLE_LINKS).evaluateAll((links) => links.map((a) => a.getAttribute('href')));
    expect(hrefs.length).toBeGreaterThan(30);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  test('header navigation goes to /series', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('navigation', { name: 'Seções' }).getByRole('link', { name: 'Séries' }).click();
    await expect(page).toHaveURL('/series');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('dragging a rail scrolls it and the click after the drag does not navigate', async ({ page }) => {
    await page.goto('/');
    const list = page.locator('section[id][aria-label] ul').first();
    const link = list.locator('a').first();
    await expect(link).toBeVisible();
    await link.scrollIntoViewIfNeeded();
    const box = (await link.boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    await page.mouse.move(x, y);
    await page.mouse.down();
    // Small drag: the pointer stays over the same poster, so the release produces a click on that link.
    await page.mouse.move(x - 10, y, { steps: 3 });
    await page.mouse.move(x - 40, y, { steps: 5 });
    expect(await list.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
    await page.mouse.up();

    await page.waitForTimeout(400); // negative assertion: give a wrongly fired navigation time to happen
    await expect(page).toHaveURL('/');

    // Control: a plain click on a poster does navigate.
    await link.click();
    await expect(page).toHaveURL(/\/(filme|serie)\/\d+-/);
  });

  test('home load logs no unused-preload warning', async ({ page }) => {
    const warnings: string[] = [];
    page.on('console', (m) => {
      if (m.text().includes('preloaded using link preload but not used')) warnings.push(m.text());
    });
    await page.goto('/', { waitUntil: 'load' });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.waitForTimeout(3500); // Chromium reports unused preloads a few seconds after load
    expect(warnings).toEqual([]);
  });
});

test.describe('mobile', () => {
  test.skip(({ isMobile }) => !isMobile, 'mobile only');

  test('shows the tab bar and hides the header links', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Seções' })).toBeHidden();
  });

  test('the tab bar never covers the credits row at the bottom of the page', async ({ page }) => {
    await page.goto('/filmes');
    const attribution = page.getByRole('contentinfo').getByText(/Powered by/);
    const tabBar = page.getByRole('navigation', { name: 'Navegação principal' });
    await expect(attribution).toBeAttached();
    // Rails stream in and resize the page, so re-scroll to the very bottom and measure in the same check:
    // a separate in-viewport assertion afterwards races the layout shifts.
    await expect
      .poll(async () => {
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        const a = (await attribution.boundingBox())!;
        const t = (await tabBar.boundingBox())!;
        return { visible: a.y >= 0 && a.y + a.height <= t.y, a: Math.round(a.y + a.height), t: Math.round(t.y) };
      })
      .toMatchObject({ visible: true });
  });
});

test('prefetching a route does not download its hero images into the current page', async ({ page }) => {
  // /descobrir preloads no TMDb image of its own (its grid is fetched client-side), and the "Início" link is
  // always visible, so the home page gets prefetched. Its hero backdrop must not come along as a preload hint.
  const homePrefetch = page.waitForResponse(
    (r) => new URL(r.url()).pathname === '/' && r.request().headers()['next-router-segment-prefetch'] === '/__PAGE__',
  );
  await page.goto('/descobrir');
  await (await homePrefetch).finished();
  // Negative assertion with no positive signal to wait on. A preload hint is applied in the same task that
  // handles the prefetch response (already finished above), so 500ms is ample; a longer wait only slows the suite.
  await page.waitForTimeout(500);
  await expect(page.locator('link[rel="preload"][as="image"][imagesrcset*="image.tmdb.org"]')).toHaveCount(0);
  await expect(page.locator('link[rel="preload"][as="image"][href*="image.tmdb.org"]')).toHaveCount(0);
});

test('hubs browse by genre and link to every genre and to discover', async ({ page }) => {
  await page.goto('/series');
  const section = page.getByRole('region', { name: 'Por gênero' });
  await expect(section.getByRole('link', { name: 'Drama', exact: true })).toHaveAttribute('href', /^\/genero\/serie\/\d+-drama$/);
  await expect(section.getByRole('link', { name: /Ver todos os gêneros/ })).toHaveAttribute('href', '/generos');
  await expect(section.getByRole('link', { name: /Descobrir/ })).toHaveAttribute('href', '/descobrir?tipo=serie');
});

test('v1 URLs render the 404 page', async ({ page }) => {
  const response = await page.goto('/popular-movies');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Cena perdida' })).toBeVisible();
});
