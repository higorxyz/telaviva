import { expect, test } from './fixtures';

test('applying type and genre updates the URL and a reload keeps the chips', async ({ page, isMobile }) => {
  await page.goto('/descobrir');
  if (isMobile) await page.getByRole('button', { name: /^Filtros/ }).click();

  const form = page.getByRole('form', { name: 'Filtros' });
  await expect(form).toBeVisible();
  await expect(form.getByText('Dados de streaming fornecidos por JustWatch.')).toBeAttached();
  await form.getByRole('button', { name: 'Série', exact: true }).click();
  await form.getByRole('button', { name: 'Drama', exact: true }).click();
  await form.getByRole('button', { name: 'Aplicar' }).click();

  await expect(page).toHaveURL(/tipo=serie&generos=\d+/);
  await expect(page.getByRole('group', { name: 'Filtros ativos' })).toContainText('Gênero: Drama');

  await page.reload();
  await expect(page).toHaveURL(/tipo=serie&generos=\d+/);
  await expect(page.getByRole('group', { name: 'Filtros ativos' })).toContainText('Gênero: Drama');
});

test('genre pages render', async ({ page }) => {
  await page.goto('/generos');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('gêneros');
  await page.goto('/genero/filme/28-acao');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Ação');
});
