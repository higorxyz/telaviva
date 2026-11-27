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

test('the trailer cover asks YouTube for the sharpest thumbnail first', async ({ page }) => {
  await page.goto('/filme/550-clube-da-luta');
  const cover = page.getByRole('button', { name: 'Assistir trailer de Clube da Luta' }).locator('img');
  await expect(cover).toHaveAttribute('src', /\/maxresdefault\.jpg$/);
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
  const picker = isMobile
    ? page.getByLabel('Temporada', { exact: true })
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
