import { expect, test } from './fixtures';

test.describe('desktop', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop only');

  test('Ctrl+K opens the palette; typing, arrow down and Enter open the detail', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.keyboard.press('Control+K');
    const input = page.getByRole('combobox', { name: 'Buscar filmes, séries e pessoas' });
    await expect(input).toBeVisible();
    await expect(input).toBeFocused();

    await input.fill('matrix');
    await expect(page.getByRole('option').first()).toBeVisible();
    await input.press('ArrowDown');
    await expect(page.getByRole('option').first()).toHaveAttribute('aria-selected', 'true');
    await input.press('Enter');
    await expect(page).toHaveURL(/\/filme\/\d+-/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});

test.describe('mobile', () => {
  test.skip(({ isMobile }) => !isMobile, 'mobile only');

  test('the Buscar tab opens /buscar with a focused input; blank text triggers no search', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: 'Buscar' }).click();
    await expect(page).toHaveURL('/buscar');
    const input = page.getByRole('searchbox', { name: 'Buscar filmes, séries e pessoas' });
    await expect(input).toBeFocused();

    const searches: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/api/search')) searches.push(r.url());
    });
    await input.pressSequentially('  ');
    await expect(page.getByRole('heading', { name: 'Comece a digitar' })).toBeVisible();
    await page.waitForTimeout(500); // negative assertion: the input debounce is 250 ms
    expect(searches).toEqual([]);
    await expect(page).toHaveURL('/buscar');
  });
});
