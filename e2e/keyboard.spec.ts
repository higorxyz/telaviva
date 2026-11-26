import type { Locator, Page } from '@playwright/test';
import { authTest } from './auth-helpers';
import { expect, test } from './fixtures';

/*
 * The main flows with the keyboard alone: every control is reached with Tab (never clicked), shows a visible focus
 * ring and works with Enter or Space. Desktop only: phones have no Tab key.
 */

const MOVIE = '/filme/550-clube-da-luta';
const SERIES = '/serie/1399-game-of-thrones?temporada=1';

test.skip(({ isMobile }) => isMobile, 'Tab navigation is a desktop concern');
// Every Tab is a round trip to check the focus: whole flows walked this way take longer than the default 60 s.
test.describe.configure({ timeout: 150_000 });

const isFocused = (target: Locator) => target.evaluate((el) => el === document.activeElement).catch(() => false);

/** Presses Tab until `target` has the focus (at most `max` times), then checks its focus ring is visible. */
async function tabTo(page: Page, target: Locator, max = 80): Promise<void> {
  await expect(target).toBeVisible();
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    if (await isFocused(target)) {
      const ring = await target.evaluate((el) => {
        const style = getComputedStyle(el);
        return (style.outlineStyle !== 'none' && style.outlineWidth !== '0px') || style.boxShadow !== 'none';
      });
      expect(ring, 'the focused control shows a focus ring').toBe(true);
      return;
    }
  }
  throw new Error(`Not reached with ${max} presses of Tab`);
}

test('the skip link is the first stop and moves past the header', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  const skip = page.getByRole('link', { name: 'Pular para o conteúdo' });
  await page.keyboard.press('Tab');
  await expect(skip).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#/);
  // The next stop is inside the content, not back in the header.
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest('main')))).toBe(true);
});

test('open a title from the home page, add it, and rate it', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  const card = page.locator('main a[href^="/filme/"]').first();
  const href = (await card.getAttribute('href'))!;
  await tabTo(page, card, 120);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(href);

  await page.goto(MOVIE);
  const want = page.getByRole('button', { name: 'Quero ver', exact: true });
  await tabTo(page, want);
  await page.keyboard.press('Enter');
  await expect(want).toHaveAttribute('aria-pressed', 'true');

  const rate = page.getByRole('button', { name: 'Dar nota para Clube da Luta' });
  await tabTo(page, rate);
  await page.keyboard.press('Enter');
  const panel = page.getByRole('dialog', { name: 'Sua nota' });
  await expect(panel.getByRole('radio', { name: '1', exact: true })).toBeFocused();
  // Esc closes and gives the focus back.
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(rate).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(panel.getByRole('radio', { name: '1', exact: true })).toBeFocused();
  await page.keyboard.press('End');
  await page.keyboard.press('ArrowLeft');
  await expect(panel.getByRole('radio', { name: '9', exact: true })).toBeFocused();
  await page.keyboard.press('Space');
  await expect(panel).toBeHidden();
  const rated = page.getByRole('button', { name: 'Sua nota para Clube da Luta: 9 de 10. Mudar nota' });
  await expect(rated).toBeFocused();
});

test('mark an episode as seen', async ({ page }) => {
  await page.goto(SERIES);
  const episode1 = page.locator('li').filter({ has: page.getByRole('heading', { name: /^E1 · / }) });
  const mark = episode1.getByRole('button', { name: 'Marcar como visto' });
  await tabTo(page, mark, 150);
  await page.keyboard.press('Space');
  await expect(episode1.getByRole('button', { name: 'Visto', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

authTest('sign in, then open and cancel, then confirm the account deletion', async ({ page, accounts }) => {
  const user = await accounts.create('teclado', { verified: true });
  await page.goto('/entrar');
  const form = page.getByRole('tabpanel');
  await tabTo(page, form.getByLabel('E-mail'));
  await page.keyboard.type(user.email);
  await tabTo(page, form.getByLabel('Senha', { exact: true }), 5);
  await page.keyboard.type(user.password);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/minha-lista/, { timeout: 30_000 });

  await tabTo(page, page.getByRole('link', { name: 'Sua conta' }));
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/conta$/);

  const remove = page.getByRole('button', { name: 'Excluir minha conta' });
  await tabTo(page, remove);
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Excluir minha conta' });
  await expect(dialog.getByLabel('Digite EXCLUIR')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(remove).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(dialog.getByLabel('Digite EXCLUIR')).toBeFocused();
  await page.keyboard.type('EXCLUIR');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText('Conta excluída.')).toBeVisible();
});
