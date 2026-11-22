import type { Browser, Page, TestInfo } from '@playwright/test';
import { EMULATOR_URL, FIREBASE_API_KEY, FIREBASE_PROJECT_ID } from './e2e-env';
import { expect, stubExternalHosts, test } from './fixtures';

/**
 * The Firebase Auth emulator's REST API (the same Identity Toolkit paths as production, plus `/emulator/v1`).
 * `Authorization: Bearer owner` is the emulator's admin credential: it allows what only the Admin SDK may do, such as
 * marking an e-mail as verified.
 */
const IDENTITY = `${EMULATOR_URL}/identitytoolkit.googleapis.com/v1`;
const ADMIN = `${IDENTITY}/projects/${FIREBASE_PROJECT_ID}`;
const EMULATOR_ADMIN = `${EMULATOR_URL}/emulator/v1/projects/${FIREBASE_PROJECT_ID}`;
const OWNER = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };

export const PASSWORD = 'filmes-e2e-2026';

async function call<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`${init.method ?? 'GET'} ${url} -> HTTP ${response.status}: ${await response.text()}`);
  return (await response.json()) as T;
}

/** Every account in the emulator, gone. Only globalSetup may do this: tests run in parallel. */
export async function clearEmulatorAccounts(): Promise<void> {
  await call(`${EMULATOR_ADMIN}/accounts`, { method: 'DELETE' });
}

/** An address no other test (nor an earlier run against a reused emulator) uses. */
export function uniqueEmail(label: string): string {
  const salt = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return `${label}-${salt}@example.com`;
}

export type TestUser = { uid: string; email: string; password: string };

/** Creates an e-mail account straight in the emulator, optionally with the e-mail already verified. */
export async function createUser(opts: { email: string; password?: string; name?: string; verified?: boolean }) {
  const password = opts.password ?? PASSWORD;
  const { localId } = await call<{ localId: string }>(`${IDENTITY}/accounts:signUp?key=${FIREBASE_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: opts.email, password, displayName: opts.name, returnSecureToken: true }),
  });
  if (opts.verified) await markVerified(localId);
  return { uid: localId, email: opts.email, password } satisfies TestUser;
}

/** Marks the account's e-mail as confirmed, as following the link in the confirmation e-mail does. */
export async function markVerified(uid: string): Promise<void> {
  await call(`${ADMIN}/accounts:update`, {
    method: 'POST',
    headers: OWNER,
    body: JSON.stringify({ localId: uid, emailVerified: true }),
  });
}

/**
 * Disables the account, as an admin would: Firebase refuses to refresh its tokens (`auth/user-disabled`) and the server
 * refuses to mint a session from them, so a lost session cannot be renewed (a true 401).
 */
export async function disableUser(uid: string): Promise<void> {
  await call(`${ADMIN}/accounts:update`, {
    method: 'POST',
    headers: OWNER,
    body: JSON.stringify({ localId: uid, disableUser: true }),
  });
}

/** Removes the accounts behind these addresses (those that still exist). */
export async function deleteUsersByEmail(emails: string[]): Promise<void> {
  if (emails.length === 0) return;
  const { users = [] } = await call<{ users?: { localId: string }[] }>(`${ADMIN}/accounts:lookup`, {
    method: 'POST',
    headers: OWNER,
    body: JSON.stringify({ email: emails }),
  });
  if (users.length === 0) return;
  await call(`${ADMIN}/accounts:batchDelete`, {
    method: 'POST',
    headers: OWNER,
    body: JSON.stringify({ localIds: users.map((u) => u.localId), force: true }),
  });
}

/** How many password-reset links the emulator "sent" to this address. */
export async function resetLinksSentTo(email: string): Promise<number> {
  const { oobCodes = [] } = await call<{ oobCodes?: { email: string; requestType: string }[] }>(
    `${EMULATOR_ADMIN}/oobCodes`,
    { method: 'GET' },
  );
  return oobCodes.filter((code) => code.email === email && code.requestType === 'PASSWORD_RESET').length;
}

// ── Through the UI, so the real client flows run (Firebase in the page, session cookie, merge) ──

/**
 * Landing after a submit chains several hops (the lazy Firebase chunk, the emulator, the session route, the merge, the
 * next page's data), and six workers share one server: more room than the default 10 s, still no fixed wait.
 */
const LANDING = { timeout: 30_000 };

const form = (page: Page) => page.getByRole('tabpanel');

/** Fills the "Entrar" tab of /entrar and submits; the caller asserts where it lands. */
export async function submitSignIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/entrar');
  await form(page).getByLabel('E-mail').fill(email);
  await form(page).getByLabel('Senha', { exact: true }).fill(password);
  await form(page).getByRole('button', { name: 'Entrar', exact: true }).click();
}

/** Signs in on /entrar and waits for the signed-in header (the list, without `?voltar=`). */
export async function signIn(page: Page, user: { email: string; password: string }): Promise<void> {
  await submitSignIn(page, user.email, user.password);
  await expect(page).toHaveURL(/\/minha-lista/, LANDING);
  await expect(page.getByRole('link', { name: 'Sua conta' })).toBeVisible();
}

/** Creates the account on the "Criar conta" tab of /entrar and waits for the signed-in header. */
export async function signUp(page: Page, user: { email: string; password: string; name?: string }): Promise<void> {
  await page.goto('/entrar');
  await page.getByRole('tab', { name: 'Criar conta' }).click();
  if (user.name) await form(page).getByLabel('Nome').fill(user.name);
  await form(page).getByLabel('E-mail').fill(user.email);
  await form(page).getByLabel('Senha', { exact: true }).fill(user.password);
  await form(page).getByRole('button', { name: 'Criar conta', exact: true }).click();
  await expect(page).toHaveURL(/\/minha-lista/, LANDING);
  await expect(page.getByRole('link', { name: 'Sua conta' })).toBeVisible();
}

/**
 * A GET from inside the page, with its cookies, answered as `{ status, body }` (body: parsed JSON, or null). Not
 * `page.request`: its pooled keep-alive socket, reused after more than the server's 5 s keep-alive timeout, can be
 * closed by the server just as the request goes out (`read ECONNRESET`), while the browser sends such a GET again on
 * a new connection.
 */
export function pageGet(page: Page, path: string, headers: Record<string, string> = {}) {
  return page.evaluate(
    async ([url, extra]) => {
      const response = await fetch(url, { headers: extra, credentials: 'same-origin', cache: 'no-store' });
      return { status: response.status, body: (await response.json().catch(() => null)) as unknown };
    },
    [path, headers] as const,
  );
}

/** The uid of the session this page's browser context holds, as the server sees it. */
export async function sessionUid(page: Page): Promise<string> {
  const { status, body } = await pageGet(page, '/api/auth/me');
  expect(status).toBe(200);
  return (body as { user: { id: string } }).user.id;
}

/**
 * A second "device": a new browser context (own cookies and storage) with the same project settings (viewport,
 * mobile emulation) and the external hosts stubbed. The test closes it.
 */
export async function openSecondDevice(browser: Browser, testInfo: TestInfo): Promise<Page> {
  const { baseURL, viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = testInfo.project.use;
  const context = await browser.newContext({ baseURL, viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });
  const page = await context.newPage();
  await stubExternalHosts(page);
  return page;
}

type Accounts = {
  /** A fresh address and the shared password, removed from the emulator after the test. */
  fresh(label: string): { email: string; password: string };
  /** An account created straight in the emulator (removed after the test). */
  create(label: string, opts?: { name?: string; verified?: boolean }): Promise<TestUser>;
};

/**
 * `test` plus `accounts`. Each test cleans up only the accounts it made: projects and workers run in parallel against
 * one emulator, so wiping every account before each test (as globalSetup does once) would sign other tests out.
 */
export const authTest = test.extend<{ accounts: Accounts }>({
  accounts: async ({}, provide) => {
    const made: string[] = [];
    await provide({
      fresh(label) {
        const email = uniqueEmail(label);
        made.push(email);
        return { email, password: PASSWORD };
      },
      async create(label, opts = {}) {
        const email = uniqueEmail(label);
        made.push(email);
        return createUser({ email, ...opts });
      },
    });
    await deleteUsersByEmail(made);
  },
});
