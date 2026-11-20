import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { savedItemCount } from './library-state';

const BLOCKED = 'Seu navegador está bloqueando o armazenamento. A lista vale só até fechar a aba.';
const MOVIE = '/filme/550-clube-da-luta';
// The default season is the last aired one; the mock serves season-1 episodes for every season, so ask for 1.
const SERIES = '/serie/1399-game-of-thrones?temporada=1';

const libraryPanel = (page: Page) => page.getByRole('tabpanel');
const episode = (page: Page, n: number): Locator =>
  page.locator('li').filter({ has: page.getByRole('heading', { name: new RegExp(`^E${n} · `) }) });

test('Quero ver on a movie saves it, survives a reload and shows in Minha lista', async ({ page }) => {
  await page.goto(MOVIE);
  const want = page.getByRole('button', { name: 'Quero ver', exact: true });
  await expect(want).toHaveAttribute('aria-pressed', 'false');
  await want.click();
  await expect(page.getByText('Salvo em Quero ver')).toBeVisible();
  await expect(want).toHaveAttribute('aria-pressed', 'true');

  await page.reload();
  await expect(want).toHaveAttribute('aria-pressed', 'true');

  await page.goto('/minha-lista?aba=quero-ver');
  await expect(page.getByRole('tab', { name: 'Quero ver · 1' })).toHaveAttribute('aria-selected', 'true');
  await expect(libraryPanel(page).getByRole('link', { name: /^Clube da Luta/ })).toBeVisible();
});

test('rating a movie 9 shows Sua nota with the ring, and Assistidos shows it with the average', async ({ page }) => {
  await page.goto(MOVIE);
  await page.getByRole('button', { name: 'Dar nota para Clube da Luta' }).click();
  const panel = page.getByRole('dialog', { name: 'Sua nota' });
  await expect(panel).toBeVisible();
  await panel.getByRole('radio', { name: '9', exact: true }).click();
  await expect(panel).toBeHidden();

  const trigger = page.getByRole('button', { name: 'Sua nota para Clube da Luta: 9 de 10. Mudar nota' });
  await expect(trigger).toContainText('Sua nota');
  await expect(trigger.getByRole('img', { includeHidden: true })).toHaveAttribute('aria-label', 'Sua nota 9,0 de 10');
  // Whoever rates a movie has watched it.
  await expect(page.getByRole('button', { name: 'Já assisti' })).toHaveAttribute('aria-pressed', 'true');

  await page.goto('/minha-lista?aba=assistidos');
  await expect(libraryPanel(page).getByRole('link', { name: /^Clube da Luta/ })).toBeVisible();
  const stats = page.getByRole('region', { name: 'Resumo da sua biblioteca' });
  await expect(stats.locator('div').filter({ hasText: 'Média das suas notas' })).toContainText('9,0');
  await expect(stats.locator('div').filter({ hasText: 'Filmes assistidos' })).toContainText('1');
});

test('marking episodes moves the series progress, and it shows in Assistindo and on the home page', async ({ page }) => {
  await page.goto(SERIES);
  const card = page.getByRole('region', { name: 'Seu progresso' });
  await expect(card).toHaveCount(0);

  for (const n of [1, 2]) {
    const mark = episode(page, n).getByRole('button', { name: 'Marcar como visto' });
    await mark.click();
    await expect(episode(page, n).getByRole('button', { name: 'Visto', exact: true })).toHaveAttribute('aria-pressed', 'true');
  }
  await expect(card).toContainText('Próximo: T1E3');
  // The next episode's name arrives with the season data.
  await expect(card).toContainText(/Próximo: T1E3 · \S/);

  await episode(page, 5).getByRole('button', { name: 'Marcar até T1E5' }).click();
  await expect(card).toContainText('Próximo: T1E6');
  await expect(card.getByRole('progressbar', { name: 'Episódios vistos' })).toHaveAttribute('aria-valuenow', '5');
  // Marking an episode puts the series in Assistindo.
  await expect(page.getByRole('button', { name: 'Assistindo', exact: true })).toBeVisible();

  await page.reload();
  await expect(card).toContainText('Próximo: T1E6');
  for (const n of [1, 3, 5]) {
    await expect(episode(page, n).getByRole('button', { name: 'Visto', exact: true })).toHaveAttribute('aria-pressed', 'true');
  }
  await expect(episode(page, 6).getByRole('button', { name: 'Marcar como visto' })).toHaveAttribute('aria-pressed', 'false');

  await page.goto('/minha-lista?aba=assistindo');
  const series = libraryPanel(page).getByRole('link', { name: /^Game of Thrones/ });
  await expect(series).toContainText('Próximo: T1E6');

  await page.goto('/');
  const rail = page.locator('section#continue-assistindo');
  await expect(rail.getByRole('heading', { name: 'Continue assistindo' })).toBeVisible();
  await expect(rail.getByRole('link', { name: /^Game of Thrones/ })).toContainText('Próximo: T1E6');
});

test('the quick action on a poster adds to Quero ver, and Desfazer takes it back', async ({ page }) => {
  await page.goto('/filmes');
  const rail = page.locator('section[id][aria-label]').first();
  const add = rail.getByRole('button', { name: /^Adicionar .+ a Quero ver$/ }).first();
  await expect(add).toBeVisible();
  const title = /^Adicionar (.+) a Quero ver$/.exec((await add.getAttribute('aria-label')) ?? '')![1]!;

  await add.click();
  await expect(page.getByText('Salvo em Quero ver')).toBeVisible();
  await expect(rail.getByRole('button', { name: `Remover ${title} de Quero ver`, exact: true }).first()).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect.poll(() => savedItemCount(page)).toBe(1);

  await page.getByRole('button', { name: 'Desfazer' }).click();
  await expect(rail.getByRole('button', { name: `Adicionar ${title} a Quero ver`, exact: true }).first()).toBeVisible();
  await expect.poll(() => savedItemCount(page)).toBe(0);
});

test('with something in the library, the home page shows Recomendados para você', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('section#recomendados')).toHaveCount(0);

  await page.goto(MOVIE);
  await page.getByRole('button', { name: 'Quero ver', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Quero ver', exact: true })).toHaveAttribute('aria-pressed', 'true');

  await page.goto('/');
  const rail = page.locator('section#recomendados');
  await expect(rail.getByRole('heading', { name: 'Recomendados para você' })).toBeVisible();
  const ids = await rail
    .locator('a[href^="/filme/"], a[href^="/serie/"]')
    .evaluateAll((links) => links.map((a) => Number(/\/(\d+)-/.exec(a.getAttribute('href') ?? '')?.[1])));
  expect(ids.length).toBeGreaterThanOrEqual(6);
  // Never the seed itself, and only titles the feed would show (odd ids in the mock are unavailable in Brazil).
  expect(ids).not.toContain(550);
  expect(ids.filter((id) => id % 2 === 1)).toEqual([]);
});

test('with storage blocked, the notice shows once and marking still works for the session', async ({ page, isMobile }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      },
    });
  });
  await page.goto(MOVIE);
  const notice = page.getByText(BLOCKED);
  await expect(notice).toBeVisible();
  await expect(notice).toHaveCount(1);
  await page.getByRole('button', { name: 'Fechar aviso' }).click();
  await expect(notice).toHaveCount(0);

  const want = page.getByRole('button', { name: 'Quero ver', exact: true });
  await want.click();
  await expect(want).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Salvo em Quero ver')).toBeVisible();

  // A client-side visit keeps the in-memory list, and the notice does not come back.
  const nav = isMobile
    ? page.getByRole('navigation', { name: 'Navegação principal' })
    : page.getByRole('navigation', { name: 'Seções' });
  await nav.getByRole('link', { name: 'Minha lista' }).click();
  await expect(page).toHaveURL(/\/minha-lista/);
  await expect(page.getByRole('tab', { name: 'Quero ver · 1' })).toBeVisible();
  await expect(libraryPanel(page).getByRole('link', { name: /^Clube da Luta/ })).toBeVisible();
  await expect(notice).toHaveCount(0);
});
