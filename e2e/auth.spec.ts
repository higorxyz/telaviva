import { readFile } from 'node:fs/promises';
import type { Locator, Page } from '@playwright/test';
import {
  authTest as test,
  openSecondDevice,
  pageGet,
  resetLinksSentTo,
  sessionUid,
  signIn,
  signUp,
  submitSignIn,
  uniqueEmail,
} from './auth-helpers';
import { expectNoViolations, settled } from './axe';
import { APP_URL } from './e2e-env';
import { expect } from './fixtures';
import { LIBRARY_KEY, savedItemCount } from './library-state';

/*
 * Sign-in, sync, merge and account deletion, end to end, against the Firebase Auth emulator and the E2E PGlite.
 *
 * Not covered here: Google sign-in, by popup or by redirect (plan, Foco 5). The emulator fakes Google only through
 * its own popup page, and the redirect needs the real /__/auth proxy to <project>.firebaseapp.com, which a `demo-*`
 * project does not have. The redirect's return trip (the flag, the uid guard on re-auth, the error toast) is covered by
 * the unit tests of src/features/auth (sign-in, redirect-return, auth-flows).
 */

const MOVIE = '/filme/550-clube-da-luta';
// The mock serves season-1 episodes for every season, so ask for 1 (see library.spec.ts).
const SERIES = '/serie/1399-game-of-thrones?temporada=1';
const LIST_SAVED = 'Sua lista foi salva na sua conta.';
const WRONG_CREDENTIALS = 'E-mail ou senha incorretos.';
const RESET_MESSAGE =
  'Se esse e-mail estiver cadastrado e confirmado, você vai receber um link para criar uma nova senha.';
const preMergeKey = (uid: string) => `${LIBRARY_KEY}:pre-merge:${uid}`;
const HOME = `${APP_URL}/`;

const libraryPanel = (page: Page) => page.getByRole('tabpanel');
const fightClub = (page: Page) => libraryPanel(page).getByRole('link', { name: /^Clube da Luta/ });
const wantButton = (page: Page) => page.getByRole('button', { name: 'Quero ver', exact: true });
const episode = (page: Page, n: number): Locator =>
  page.locator('li').filter({ has: page.getByRole('heading', { name: new RegExp(`^E${n} · `) }) });
const errorToasts = (page: Page) => page.locator('[data-toast][data-tone="error"]');
const isCommand = (url: string, method: string) => url.endsWith('/api/library/commands') && method === 'POST';
const isLibraryLoad = (url: string, method: string) => new URL(url).pathname === '/api/library' && method === 'GET';

const stored = (page: Page, key: string) => page.evaluate((k) => window.localStorage.getItem(k), key);

/** As a visitor: Clube da Luta in Quero ver, saved on this device. */
async function guestWantsFightClub(page: Page): Promise<void> {
  await page.goto(MOVIE);
  await wantButton(page).click();
  await expect(wantButton(page)).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => savedItemCount(page)).toBe(1);
}

/** Clicks and waits until the account saved the command (the button turns on before the server answers). */
async function clickAndSave(page: Page, target: Locator): Promise<void> {
  const saved = page.waitForResponse((r) => isCommand(r.url(), r.request().method()) && r.ok());
  await target.click();
  await saved;
}

test('a visitor who creates an account keeps their list, now in the account', async ({ page, accounts }) => {
  await guestWantsFightClub(page);

  await signUp(page, { ...accounts.fresh('cadastro'), name: 'Ana' });
  await expect(page.getByText(LIST_SAVED)).toBeVisible();
  await expect(fightClub(page)).toBeVisible();

  const uid = await sessionUid(page);
  // The guest copy is gone and the backup taken before the merge stays.
  await expect.poll(() => stored(page, LIBRARY_KEY)).toBeNull();
  await expect.poll(async () => JSON.parse((await stored(page, preMergeKey(uid))) ?? '{"items":[]}').items).toHaveLength(1);

  await page.reload();
  await expect(fightClub(page)).toBeVisible();
});

test('two devices on the same account see each other’s changes', async ({ page, browser, accounts }, testInfo) => {
  const user = await accounts.create('sync', { verified: true });
  await signIn(page, user);
  await page.goto(MOVIE);
  await clickAndSave(page, wantButton(page));
  await page.goto(SERIES);
  await expect(episode(page, 1).getByRole('button', { name: 'Marcar como visto' })).toHaveAttribute('aria-pressed', 'false');

  const other = await openSecondDevice(browser, testInfo);
  try {
    await signIn(other, user);
    await expect(fightClub(other)).toBeVisible();
    await other.goto(SERIES);
    await clickAndSave(other, episode(other, 1).getByRole('button', { name: 'Marcar como visto' }));
  } finally {
    await other.context().close();
  }

  await page.reload();
  await expect(episode(page, 1).getByRole('button', { name: 'Visto', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('region', { name: 'Seu progresso' })).toContainText('Próximo: T1E2');
});

test('after signing out the list is empty, and signing in brings it back', async ({ page, accounts }) => {
  await guestWantsFightClub(page);
  const user = accounts.fresh('sair');
  await signUp(page, user);
  await expect(fightClub(page)).toBeVisible();

  await page.goto('/conta');
  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL(HOME);
  await expect(page.getByRole('link', { name: 'Entrar', exact: true })).toBeVisible();

  // The merge emptied the visitor's list on this device.
  await page.goto('/minha-lista?aba=quero-ver');
  await expect(page.getByText('Entre para ver sua lista em todos os aparelhos.')).toBeVisible();
  await expect(page.getByText('Sua lista está vazia')).toBeVisible();
  expect(await savedItemCount(page)).toBe(0);

  await signIn(page, user);
  await expect(fightClub(page)).toBeVisible();
});

test('with the session cookie gone, the next action renews it silently and is saved', async ({ page, accounts }) => {
  const user = await accounts.create('sessao', { verified: true });
  await signIn(page, user);
  // The page's own library load must be done before the cookie goes: one still on its way would meet the 401
  // first and renew the session itself, and the command below would then never see a 401.
  const loaded = page.waitForResponse((r) => isLibraryLoad(r.url(), r.request().method()) && r.ok());
  await page.goto(MOVIE);
  await loaded;
  await expect(page.getByRole('link', { name: 'Sua conta' })).toBeVisible();

  await page.context().clearCookies({ name: 'tv_session' });
  const names = async () => (await page.context().cookies()).map((c) => c.name);
  expect(await names()).toContain('tv_auth');
  expect(await names()).not.toContain('tv_session');

  // The first try answers 401; the client mints a new session from Firebase and sends the command again.
  const refused = page.waitForResponse((r) => isCommand(r.url(), r.request().method()) && r.status() === 401);
  await clickAndSave(page, wantButton(page));
  await refused;
  await expect(wantButton(page)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Salvo em Quero ver')).toBeVisible();
  expect(await names()).toContain('tv_session');
  await expect(errorToasts(page)).toHaveCount(0);
  await expect(page.getByText('Sua sessão expirou')).toHaveCount(0);

  await page.reload();
  await expect(wantButton(page)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('link', { name: 'Sua conta' })).toBeVisible();
  await expect(errorToasts(page)).toHaveCount(0);
});

test('a wrong password says so, and the reset answer never tells who has an account', async ({ page, accounts }) => {
  const verified = await accounts.create('senha', { verified: true });
  const unverified = await accounts.create('naoconfirmado');

  await submitSignIn(page, verified.email, 'senha-errada-123');
  await expect(page.getByText(WRONG_CREDENTIALS)).toBeVisible();
  await expect(page).toHaveURL(/\/entrar/);

  const reset = page.getByRole('form', { name: 'Esqueci minha senha' });
  async function askReset(email: string) {
    await page.getByRole('button', { name: 'Esqueci minha senha' }).click();
    await reset.getByLabel('E-mail').fill(email);
    await reset.getByRole('button', { name: 'Enviar link' }).click();
    await expect(reset.getByRole('status')).toHaveText(RESET_MESSAGE);
    await page.getByRole('button', { name: 'Voltar' }).click();
  }

  // Same answer for an unconfirmed account, an address nobody has and a confirmed account.
  await askReset(unverified.email);
  await askReset(uniqueEmail('ninguem'));
  await askReset(verified.email);
  // Only the confirmed account gets a link. Asked last, its link arriving means the earlier lookups had their turn.
  await expect.poll(() => resetLinksSentTo(verified.email)).toBe(1);
  expect(await resetLinksSentTo(unverified.email)).toBe(0);
});

test('the export holds the list, and a deleted account cannot sign in again', async ({ page, accounts }) => {
  await guestWantsFightClub(page);
  const user = accounts.fresh('excluir');
  await signUp(page, user);
  await expect(fightClub(page)).toBeVisible();
  const uid = await sessionUid(page);

  await page.goto('/conta');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar meus dados' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^telaviva-meus-dados-\d{4}-\d{2}-\d{2}\.json$/);
  const data = JSON.parse(await readFile(await file.path(), 'utf8'));
  expect(data.user).toMatchObject({ id: uid, email: user.email });
  expect(data.library.items).toEqual([expect.objectContaining({ mediaType: 'movie', tmdbId: 550, status: 'want' })]);

  await page.getByRole('button', { name: 'Excluir minha conta' }).click();
  const dialog = page.getByRole('dialog', { name: 'Excluir minha conta' });
  const forever = dialog.getByRole('button', { name: 'Excluir para sempre' });
  await expect(forever).toHaveAttribute('aria-disabled', 'true');
  await dialog.getByLabel('Digite EXCLUIR').fill('EXCLUIR');
  await forever.click();

  await expect(page).toHaveURL(HOME);
  await expect(page.getByText('Conta excluída.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Entrar', exact: true })).toBeVisible();
  await expect.poll(() => stored(page, preMergeKey(uid))).toBeNull();
  expect((await pageGet(page, '/api/auth/me')).status).toBe(401);

  await submitSignIn(page, user.email, user.password);
  await expect(page.getByText(WRONG_CREDENTIALS)).toBeVisible();
  await expect(page).toHaveURL(/\/entrar/);
});

test.describe('accessibility', () => {
  test('no WCAG A/AA violations on /entrar, on both tabs', async ({ page }) => {
    await page.goto('/entrar');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await settled(page.locator('body'));
    await expectNoViolations(page);
    await page.getByRole('tab', { name: 'Criar conta' }).click();
    await expect(page.getByRole('tabpanel').getByLabel('Nome')).toBeVisible();
    await settled(page.locator('body'));
    await expectNoViolations(page);
  });

  // Unconfirmed on purpose: the inline "Reenviar e-mail" is on screen and checked too (the banner stays off /conta).
  test('no WCAG A/AA violations on /conta and with the deletion dialog open', async ({ page, accounts }) => {
    await signIn(page, await accounts.create('a11y'));
    await page.goto('/conta');
    await expect(page.getByRole('button', { name: 'Exportar meus dados' })).toBeVisible();
    await expect(page.getByRole('main').getByRole('button', { name: 'Reenviar e-mail' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Confirmação de e-mail' })).toHaveCount(0);
    await settled(page.locator('body'));
    await expectNoViolations(page);

    await page.getByRole('button', { name: 'Excluir minha conta' }).click();
    const dialog = page.getByRole('dialog', { name: 'Excluir minha conta' });
    await expect(dialog.getByLabel('Digite EXCLUIR')).toBeFocused();
    await settled(dialog);
    await expectNoViolations(page);
  });
});
