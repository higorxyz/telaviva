import { expect, test } from './fixtures';

test('/filme/550 redirects (308) to the canonical URL', async ({ page, request }) => {
  const raw = await request.get('/filme/550', { maxRedirects: 0 });
  expect(raw.status()).toBe(308);
  expect(raw.headers().location).toContain('/filme/550-clube-da-luta');

  await page.goto('/filme/550');
  await expect(page).toHaveURL(/\/filme\/550-clube-da-luta$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Clube da Luta');
  await expect(page.getByRole('heading', { name: 'Onde assistir' })).toBeVisible();
  await expect(page.getByText('Dados de streaming fornecidos por JustWatch.')).toBeVisible();
});

test('leaving a title page stops its trailer, and Back shows the cover again', async ({ page, isMobile }) => {
  const players = page.locator('iframe[src*="youtube-nocookie.com"]');
  await page.goto('/filme/550-clube-da-luta');
  await page.getByRole('button', { name: 'Assistir trailer de Clube da Luta' }).click();
  await expect(players).toHaveCount(1);

  // The header links live in the tab bar on mobile.
  const nav = isMobile
    ? page.getByRole('navigation', { name: 'Navegação principal' })
    : page.getByRole('navigation', { name: 'Seções' });
  await nav.getByRole('link', { name: 'Filmes', exact: true }).click();
  await expect(page).toHaveURL('/filmes');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  // The previous route stays mounted in a hidden <Activity>: no player may survive there, hidden or not.
  await expect(players).toHaveCount(0);

  await page.goBack();
  await expect(page).toHaveURL(/\/filme\/550-clube-da-luta$/);
  await expect(page.getByRole('button', { name: 'Assistir trailer de Clube da Luta' })).toBeVisible();
  await expect(players).toHaveCount(0);
});

test('the trailer cover asks YouTube for the sharpest thumbnail the player needs', async ({ page, isMobile }) => {
  await page.goto('/filme/550-clube-da-luta');
  const cover = page.getByRole('button', { name: 'Assistir trailer de Clube da Luta' }).locator('img');
  await cover.scrollIntoViewIfNeeded();
  // maxres where the player is wider than 640 px (md up); sd on a phone, which is sharp enough there.
  const expected = isMobile ? /\/sddefault\.jpg$/ : /\/maxresdefault\.jpg$/;
  await expect.poll(() => cover.evaluate((img: HTMLImageElement) => img.currentSrc)).toMatch(expected);
});

test('unknown title id renders the 404 page', async ({ page }) => {
  const response = await page.goto('/filme/999999999-x');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Cena perdida' })).toBeVisible();
});

test('series page lists episodes and switching season keeps the scroll position', async ({ page, isMobile }) => {
  await page.goto('/serie/1399-game-of-thrones?temporada=1');
  await expect(page.getByRole('heading', { name: /^E1 · / }).first()).toBeVisible();

  // Bring the picker into view first, so Playwright's own scroll-before-click does not move the page later.
  // Inside the section's landmark: while the page streams, React may still hold a hidden copy of the streamed
  // content (no roles exposed), and a page-wide getByLabel would then match two selects.
  const picker = isMobile
    ? page.getByRole('region', { name: 'Temporadas e episódios' }).getByLabel('Temporada', { exact: true })
    : page.getByRole('navigation', { name: 'Temporadas' }).getByRole('link', { name: 'Temporada 2' });
  await picker.scrollIntoViewIfNeeded();
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
  const before = await page.evaluate(() => window.scrollY);
  expect(before).toBeGreaterThan(300);

  if (isMobile) await picker.selectOption('2');
  else await picker.click();
  await expect(page).toHaveURL(/\?temporada=2$/);
  await expect(page.getByRole('heading', { name: /^E1 · / }).first()).toBeVisible();
  const after = await page.evaluate(() => window.scrollY);
  expect(Math.abs(after - before)).toBeLessThan(50);
});

test('series page: cast photos wait for the person to scroll near them (they never compete with the backdrop)', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'the long episode list pushes the cast far below on a phone');
  const requested: string[] = [];
  page.on('request', (r) => {
    if (r.resourceType() === 'image') requested.push(r.url());
  });
  // Series 4242: the mock answers its seasons late, so the episodes stream in well after the static shell.
  await page.goto('/serie/4242-game-of-thrones?temporada=1', { waitUntil: 'load' });
  const cast = page.locator('#elenco img');
  await expect(cast.first()).toBeAttached();
  await page.waitForTimeout(1000);
  const sources = await cast.evaluateAll((imgs) => imgs.map((img) => (img as HTMLImageElement).src));
  expect(sources.length).toBeGreaterThan(0);
  expect(requested.filter((url) => sources.some((src) => url.split('/').pop() === src.split('/').pop()))).toEqual([]);

  await page.locator('#elenco').scrollIntoViewIfNeeded();
  await expect
    .poll(() => requested.filter((url) => sources.some((src) => url.split('/').pop() === src.split('/').pop())).length)
    .toBeGreaterThan(0);
});
