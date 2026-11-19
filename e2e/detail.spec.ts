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
