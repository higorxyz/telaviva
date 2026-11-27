import { expectNoViolations, settled } from './axe';
import { expect, test } from './fixtures';
import { seedLibrary } from './library-state';

const PAGES = [
  '/',
  '/filme/550-clube-da-luta',
  '/serie/1399-game-of-thrones',
  '/buscar',
  '/descobrir',
  '/generos',
  '/pessoa/287-brad-pitt',
];

for (const path of PAGES) {
  test(`no WCAG A/AA violations on ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await expect(page.getByRole('status', { name: 'Carregando resultados' })).toHaveCount(0);
    await expectNoViolations(page);
  });
}

for (const tab of ['assistindo', 'quero-ver', 'assistidos']) {
  test(`no WCAG A/AA violations on /minha-lista?aba=${tab} with a filled library`, async ({ page }) => {
    await seedLibrary(page);
    await page.goto(`/minha-lista?aba=${tab}`);
    await expect(page.getByRole('region', { name: 'Resumo da sua biblioteca' })).toBeVisible();
    await expect(page.getByRole('tabpanel').getByRole('link').first()).toBeVisible();
    await expectNoViolations(page);
  });
}

test('no WCAG A/AA violations on a series with progress and marked episodes', async ({ page }) => {
  await seedLibrary(page);
  await page.goto('/serie/1399-game-of-thrones?temporada=1');
  await expect(page.getByRole('region', { name: 'Seu progresso' })).toContainText('Próximo: T1E6');
  await expect(page.getByRole('button', { name: 'Visto', exact: true }).first()).toBeVisible();
  await expectNoViolations(page);
});

test('no WCAG A/AA violations with the rating panel open', async ({ page }) => {
  await page.goto('/filme/550-clube-da-luta');
  await page.getByRole('button', { name: 'Dar nota para Clube da Luta' }).click();
  const panel = page.getByRole('dialog', { name: 'Sua nota' });
  await expect(panel.getByRole('radiogroup', { name: 'Sua nota para Clube da Luta' })).toBeVisible();
  await settled(panel);
  await expectNoViolations(page);
});
