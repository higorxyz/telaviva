import { expect, test } from './fixtures';

test('Voltar returns to the previous page and restores its scroll position', async ({ page, isMobile }) => {
  test.skip(isMobile, 'covered on desktop; mobile checks the direct-link case');
  await page.goto('/');
  const rails = page.locator('section[id][aria-label]');
  await expect.poll(() => rails.count()).toBeGreaterThanOrEqual(4);
  const link = rails.nth(3).locator('a[href^="/filme/"], a[href^="/serie/"]').first();
  await link.scrollIntoViewIfNeeded();
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
  const before = await page.evaluate(() => window.scrollY);
  expect(before).toBeGreaterThan(300);

  await link.click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page).toHaveURL(/\/(filme|serie)\/\d+-/);
  await page.getByRole('button', { name: 'Voltar' }).click();
  await expect(page).toHaveURL('/');
  await expect(link).toBeVisible();
  await expect.poll(async () => Math.abs((await page.evaluate(() => window.scrollY)) - before)).toBeLessThan(50);
});

test('Voltar on a directly opened title goes to /filmes', async ({ page }) => {
  await page.goto('/filme/550-clube-da-luta');
  await page.getByRole('button', { name: 'Voltar' }).click();
  await expect(page).toHaveURL('/filmes');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
