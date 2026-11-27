import { expect, test } from './fixtures';

test('picking the type and a genre applies at once, and a reload keeps the chips', async ({ page }) => {
  await page.goto('/descobrir');
  const filters = page.getByRole('search', { name: 'Filtros' });
  await expect(page.getByRole('button', { name: 'Aplicar' })).toHaveCount(0);

  await filters.getByRole('button', { name: 'Séries', exact: true }).click();
  await expect(page).toHaveURL(/\?tipo=serie$/);

  const trigger = filters.getByRole('button', { name: /^Gêneros/ });
  await trigger.click();
  const panel = page.getByRole('dialog', { name: 'Gêneros' });
  await expect(panel).toBeVisible();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await panel.getByRole('button', { name: 'Drama', exact: true }).click();

  await expect(page).toHaveURL(/tipo=serie&generos=\d+/);
  await expect(page.getByRole('group', { name: 'Filtros ativos' })).toContainText('Gênero: Drama');
  await expect(panel).toBeVisible(); // multi-select stays open
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveText('Gêneros · 1');

  await page.reload();
  await expect(page).toHaveURL(/tipo=serie&generos=\d+/);
  await expect(page.getByRole('group', { name: 'Filtros ativos' })).toContainText('Gênero: Drama');
});

test('each filter opens as a popover on desktop and as a bottom sheet on mobile', async ({ page, isMobile }) => {
  await page.goto('/descobrir');
  const trigger = page.getByRole('search', { name: 'Filtros' }).getByRole('button', { name: /^Onde assistir/ });
  await trigger.click();
  const panel = page.getByRole('dialog', { name: 'Onde assistir' });
  await expect(panel).toBeVisible();
  await expect(panel.getByText('Dados de streaming fornecidos por JustWatch.')).toBeVisible();

  // Polled: the sheet rises and the popover settles in with a short entrance animation.
  const box = async () => (await panel.boundingBox())!;
  if (isMobile) {
    const viewport = page.viewportSize()!;
    await expect
      .poll(async () => {
        const b = await box();
        return [Math.round(b.y + b.height), Math.round(b.width)];
      })
      .toEqual([viewport.height, viewport.width]);
  } else {
    const anchor = (await trigger.boundingBox())!;
    await expect.poll(async () => (await box()).y).toBeGreaterThanOrEqual(anchor.y + anchor.height);
  }

  await panel.getByRole('group', { name: 'Onde assistir' }).getByRole('button').first().click();
  await expect(page).toHaveURL(/provedores=\d+/);
  await panel.getByRole('button', { name: 'Fechar Onde assistir' }).click();
  await expect(panel).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveText('Onde assistir · 1');
});

test('Disponível no Brasil is on by default; turning it off shows a chip and Limpar tudo restores it', async ({ page }) => {
  await page.goto('/descobrir');
  const toggle = page.getByRole('search', { name: 'Filtros' }).getByRole('button', { name: 'Disponível no Brasil' });
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  const chips = page.getByRole('group', { name: 'Filtros ativos' });
  await expect(chips.getByRole('button', { name: 'Limpar tudo' })).toHaveCount(0);

  const next = page.waitForRequest((r) => new URL(r.url()).searchParams.get('disponivel') === '0');
  await toggle.click();
  await next;
  await expect(page).toHaveURL(/\?disponivel=0$/);
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(chips).toContainText('Inclui indisponíveis no Brasil');

  await chips.getByRole('button', { name: 'Limpar tudo' }).click();
  await expect(page).toHaveURL(/\/descobrir$/);
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
});

test('genre pages render', async ({ page }) => {
  await page.goto('/generos');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('gêneros');
  await page.goto('/genero/filme/28-acao');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Ação');
});
