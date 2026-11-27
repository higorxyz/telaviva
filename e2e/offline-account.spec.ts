import { authTest as test, disableUser, openSecondDevice, signIn } from './auth-helpers';
import { expect } from './fixtures';
import {
  addButton,
  isCommand,
  queuedIds,
  saving,
  seriesOf,
  serverLibrary,
  signedIn,
  signInLink,
  startWatching,
} from './offline-account-helpers';
import {
  markButton,
  OFFLINE_TEXT,
  privateCachedUrls,
  removeSeries,
  seenButton,
  SERIES_SEASON_1,
  stubImagesForWorker,
  SYNCED_TEXT,
  waitForWorkerControl,
} from './offline-helpers';

/*
 * The account side of offline use (spec §6.3), end to end, against the Auth emulator and the E2E PGlite: the queue,
 * its sync, a conflict with another device (Foco 4), signing out offline and a session that ends for good (Foco 3).
 * Every test ends checking that no cache of the service worker holds a private answer (spec §4).
 */
test.use({ serviceWorkers: 'allow' });

test.beforeEach(async ({ context }) => {
  await stubImagesForWorker(context);
});

const MOVIE = '/filme/550-clube-da-luta';
const ONE_QUEUED = '1 ação aguardando envio';
const SESSION_EXPIRED = 'Sua sessão expirou. Entre de novo para sincronizar.';

test('signed in offline: still in, the list shows, a mark waits in the queue and syncs when back online', async ({
  page,
  context,
  browser,
  accounts,
}, testInfo) => {
  const user = await accounts.create('fila', { verified: true });
  await signIn(page, user);
  await waitForWorkerControl(page);
  await page.goto(SERIES_SEASON_1);
  await startWatching(page, user.uid);

  await context.setOffline(true);
  await page.reload();
  await expect(signedIn(page)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Assistindo', exact: true })).toBeVisible();
  await expect(page.getByText(OFFLINE_TEXT)).toBeVisible();
  await expect(page.getByText(/aguardando envio/)).toHaveCount(0);
  await page.goto('/minha-lista');
  await expect(page.getByRole('tabpanel').getByRole('link', { name: /^Game of Thrones/ })).toBeVisible();
  await expect(signedIn(page)).toBeVisible();

  await page.goto(SERIES_SEASON_1);
  await markButton(page, 1).click();
  await expect(seenButton(page, 1)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText(ONE_QUEUED)).toBeVisible();

  await context.setOffline(false);
  await expect(page.getByText(SYNCED_TEXT)).toBeVisible();
  const other = await openSecondDevice(browser, testInfo);
  try {
    await signIn(other, user);
    expect(seriesOf(await serverLibrary(other, user.uid))).toEqual({
      items: [expect.objectContaining({ status: 'watching' })],
      episodes: [expect.objectContaining({ seasonNumber: 1, episodeNumber: 1 })],
    });
  } finally {
    await other.context().close();
  }
  expect(await privateCachedUrls(page)).toEqual([]);
});

test('a mark made offline never brings back a series another device of the account removed later', async ({
  page,
  context,
  browser,
  accounts,
}, testInfo) => {
  const user = await accounts.create('conflito', { verified: true });
  await signIn(page, user);
  await page.goto(SERIES_SEASON_1);
  await startWatching(page, user.uid);
  const other = await openSecondDevice(browser, testInfo);
  try {
    await stubImagesForWorker(other.context());
    await signIn(other, user);

    await context.setOffline(true);
    await markButton(page, 1).click();
    await expect(page.getByText(ONE_QUEUED)).toBeVisible();

    await other.goto(SERIES_SEASON_1);
    await saving(other, () => removeSeries(other));

    await context.setOffline(false);
    await expect(page.getByText(SYNCED_TEXT)).toBeVisible();
    await expect(addButton(page)).toBeVisible();
    await expect(markButton(page, 1)).toHaveAttribute('aria-pressed', 'false');
    expect(seriesOf(await serverLibrary(other, user.uid))).toEqual({ items: [], episodes: [] });
    await other.reload();
    await expect(addButton(other)).toBeVisible();
    await page.reload();
    await expect(addButton(page)).toBeVisible();
  } finally {
    await other.context().close();
  }
  expect(await privateCachedUrls(page)).toEqual([]);
});

test('signing out offline drops the queued action, reopens as a visitor and clears the session first once online', async ({
  page,
  context,
  accounts,
}) => {
  const user = await accounts.create('sair', { verified: true });
  await signIn(page, user);
  await waitForWorkerControl(page);
  await page.goto('/conta');
  await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible();
  await page.goto(SERIES_SEASON_1);
  await startWatching(page, user.uid);

  await context.setOffline(true);
  await markButton(page, 1).click();
  await expect(page.getByText(ONE_QUEUED)).toBeVisible();
  await page.goto('/conta');
  await page.getByRole('button', { name: 'Sair' }).click();
  const dialog = page.getByRole('dialog', { name: 'Você tem 1 ação não enviada. Sair agora descarta essa ação.' });
  await expect(dialog.getByRole('button', { name: 'Cancelar' })).toBeFocused();
  await dialog.getByRole('button', { name: 'Sair mesmo assim' }).click();
  // Off to the home page, as online (offline, the saved copy of `/`).
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  await expect(signInLink(page)).toBeVisible();
  const cookieNames = async () => (await context.cookies()).map((c) => c.name);
  // httpOnly: only the server can clear it, and the server is out of reach.
  expect(await cookieNames()).toContain('tv_session');

  await page.reload();
  await expect(signInLink(page)).toBeVisible();
  await expect(signedIn(page)).toHaveCount(0);
  await page.goto('/minha-lista');
  await expect(page.getByText('Entre para ver sua lista em todos os aparelhos.')).toBeVisible();
  await expect(page.getByText('Sua lista está vazia')).toBeVisible();

  // Once online, the DELETE goes before any library request, and no library request carries the old cookie.
  const calls: Promise<{ call: string; withSession: boolean }>[] = [];
  page.on('request', (request) => {
    const { pathname } = new URL(request.url());
    if (pathname !== '/api/auth/session' && !pathname.startsWith('/api/library')) return;
    // In arrival order; the Cookie header is only in the full header list.
    calls.push(
      request.headerValue('cookie').then((cookie) => ({
        call: `${request.method()} ${pathname}`,
        withSession: /(^|;\s*)tv_session=/.test(cookie ?? ''),
      })),
    );
  });
  await context.setOffline(false);
  await expect.poll(cookieNames).not.toContain('tv_session');
  const seen = await Promise.all(calls);
  expect(seen[0]?.call).toBe('DELETE /api/auth/session');
  expect(seen.slice(1).filter((c) => c.withSession)).toEqual([]);
  await page.reload();
  await expect(signInLink(page)).toBeVisible();
  expect(await privateCachedUrls(page)).toEqual([]);
});

test('a session that ends for good keeps its queued action, and the next account on the device never sends it', async ({
  page,
  context,
  accounts,
}) => {
  const a = await accounts.create('expira', { verified: true });
  const b = await accounts.create('seguinte', { verified: true });
  await signIn(page, a);
  await page.goto(SERIES_SEASON_1);
  await startWatching(page, a.uid);

  await context.setOffline(true);
  await markButton(page, 1).click();
  await expect(page.getByText(ONE_QUEUED)).toBeVisible();
  const queued = await queuedIds(page, a.uid);
  expect(queued).toHaveLength(1);

  // A true 401: the cookie is gone and the account is disabled, so the silent renewal is refused too.
  await disableUser(a.uid);
  await context.clearCookies({ name: 'tv_session' });
  const refused = page.waitForResponse((r) => isCommand(r.request()) && r.status() === 401);
  await context.setOffline(false);
  await refused;
  await expect(page.getByText(SESSION_EXPIRED)).toBeVisible();
  await expect(signInLink(page)).toBeVisible();
  expect(await queuedIds(page, a.uid)).toEqual(queued);

  const sentAsB: { body: string; user: string | undefined }[] = [];
  page.on('request', (request) => {
    if (isCommand(request)) sentAsB.push({ body: request.postData() ?? '', user: request.headers()['x-expected-user'] });
  });
  await signIn(page, b);
  await page.goto(MOVIE);
  // A successful action sends whatever is queued for the account signed in: only B's own.
  await saving(page, () => page.getByRole('button', { name: 'Quero ver', exact: true }).click());

  expect(sentAsB.length).toBeGreaterThan(0);
  expect(sentAsB.filter((sent) => sent.user !== b.uid || sent.body.includes(queued[0]!))).toEqual([]);
  const library = await serverLibrary(page, b.uid);
  expect(library.items.map((i) => `${i.mediaType}:${i.tmdbId}`)).toEqual(['movie:550']);
  expect(library.episodes).toEqual([]);
  // Still kept for A, to be sent if A signs in again.
  expect(await queuedIds(page, a.uid)).toEqual(queued);
  expect(await privateCachedUrls(page)).toEqual([]);
});
