// @vitest-environment node
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adminAuthMock, resetAdminAuthMock, stubAuthEnv } from '@/test/admin-auth';
import { server } from '@/test/server';
import { env } from '@/lib/env';

// `after()` needs Next's request scope: here it runs the task at once and keeps its promise, so a test can wait for
// the work that follows the response.
const tasks = vi.hoisted(() => [] as Promise<unknown>[]);
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: (task: () => unknown) => {
    tasks.push(Promise.resolve().then(task));
  },
}));
vi.mock('firebase-admin/app', async () => (await import('@/test/admin-auth')).adminAppModule);
vi.mock('firebase-admin/auth', async () => (await import('@/test/admin-auth')).adminAuthModule);
vi.mock('@/lib/auth-config', () => ({
  publicFirebaseConfig: { apiKey: 'test-api-key', authDomain: 'localhost:3000', projectId: 'demo-telaviva', appId: 'app' },
  authEnabled: true,
  authEmulatorHost: null,
}));

import { POST } from './route';

const MESSAGE = 'Se esse e-mail estiver cadastrado e confirmado, você vai receber um link para criar uma nova senha.';
const LOCAL = 'http://localhost:3000';
// The site itself, as a browser calling the same API would say (keeps a referrer-restricted key from failing silently).
const SITE_REFERER = `${new URL(env.SITE_URL).origin}/`;

type Sent = { url: string; body: unknown; referer: string | null };
let sent: Sent[];

function listen(base = 'https://identitytoolkit.googleapis.com/v1/*') {
  server.use(
    http.post(base, async ({ request }) => {
      sent.push({ url: request.url, body: await request.json(), referer: request.headers.get('referer') });
      return HttpResponse.json({ email: 'ana@example.com' });
    }),
  );
}

beforeEach(() => {
  tasks.length = 0;
  sent = [];
  resetAdminAuthMock();
  stubAuthEnv(vi.stubEnv);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  listen();
});
afterEach(() => vi.unstubAllEnvs());

const post = async (body: string, headers: Record<string, string> = {}) => {
  const res = await POST(
    new Request(`${LOCAL}/api/auth/password-reset`, {
      method: 'POST',
      headers: { host: 'localhost:3000', origin: LOCAL, 'content-type': 'application/json', ...headers },
      body,
    }),
  );
  await Promise.all(tasks);
  return res;
};
const reset = (email: unknown) => post(JSON.stringify({ email }));

async function snapshot(res: Response) {
  return { status: res.status, body: await res.json(), cache: res.headers.get('cache-control') };
}

const user = (emailVerified: boolean) => ({ uid: 'user-1', email: 'ana@example.com', emailVerified });
const notFound = () => Object.assign(new Error('no user'), { code: 'auth/user-not-found' });

describe('POST /api/auth/password-reset', () => {
  it('asks Firebase to send the reset e-mail for a verified account', async () => {
    adminAuthMock.getUserByEmail.mockResolvedValue(user(true));
    const res = await reset('  ana@example.com ');
    expect(await snapshot(res)).toEqual({ status: 200, body: { message: MESSAGE }, cache: 'private, no-store' });
    expect(adminAuthMock.getUserByEmail).toHaveBeenCalledWith('ana@example.com');
    expect(sent).toEqual([
      {
        url: 'https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=test-api-key',
        body: { requestType: 'PASSWORD_RESET', email: 'ana@example.com' },
        referer: SITE_REFERER,
      },
    ]);
  });

  it('sends nothing for an unverified, missing or unreadable account, and answers exactly the same', async () => {
    adminAuthMock.getUserByEmail.mockResolvedValueOnce(user(true));
    const verified = await snapshot(await reset('ana@example.com'));
    sent = [];

    adminAuthMock.getUserByEmail.mockResolvedValueOnce(user(false));
    const unverified = await snapshot(await reset('ana@example.com'));
    adminAuthMock.getUserByEmail.mockRejectedValueOnce(notFound());
    const missing = await snapshot(await reset('ninguem@example.com'));
    adminAuthMock.getUserByEmail.mockRejectedValueOnce(new Error('firebase down'));
    const broken = await snapshot(await reset('ana@example.com'));

    expect(sent).toEqual([]);
    for (const other of [unverified, missing, broken]) expect(other).toEqual(verified);
  });

  it.each([
    ['not an e-mail', JSON.stringify({ email: 'ana' })],
    ['a non-string', JSON.stringify({ email: 42 })],
    ['no e-mail', '{}'],
    ['not json', 'oops'],
    ['an array', '[]'],
    ['a body over 4 KB', JSON.stringify({ email: `${'a'.repeat(5000)}@example.com` })],
  ])('answers the same 200 for %s, without looking anything up', async (_label, body) => {
    const res = await post(body);
    expect(await snapshot(res)).toEqual({ status: 200, body: { message: MESSAGE }, cache: 'private, no-store' });
    expect(adminAuthMock.getUserByEmail).not.toHaveBeenCalled();
    expect(sent).toEqual([]);
  });

  it('logs a failure without the e-mail', async () => {
    adminAuthMock.getUserByEmail.mockRejectedValue(
      Object.assign(new Error('lookup failed for segredo@example.com'), { code: 'auth/internal-error' }),
    );
    await reset('segredo@example.com');
    const logged = vi.mocked(console.error).mock.calls.flat().map(String).join(' ');
    expect(logged).toContain('auth/internal-error');
    expect(logged).not.toContain('segredo');
  });

  it('logs a refused send (status only) and still answers 200', async () => {
    server.use(
      http.post('https://identitytoolkit.googleapis.com/v1/*', () =>
        HttpResponse.json({ error: { message: 'EMAIL_NOT_FOUND segredo@example.com' } }, { status: 400 }),
      ),
    );
    adminAuthMock.getUserByEmail.mockResolvedValue(user(true));
    const res = await reset('segredo@example.com');
    expect(res.status).toBe(200);
    const logged = vi.mocked(console.error).mock.calls.flat().map(String).join(' ');
    expect(logged).toContain('400');
    expect(logged).not.toContain('segredo');
  });

  it('talks to the Auth emulator when FIREBASE_AUTH_EMULATOR_HOST is set', async () => {
    vi.stubEnv('FIREBASE_AUTH_EMULATOR_HOST', '127.0.0.1:9099');
    listen('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/*');
    adminAuthMock.getUserByEmail.mockResolvedValue(user(true));
    await reset('ana@example.com');
    expect(sent.map((s) => s.url)).toEqual([
      'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=test-api-key',
    ]);
  });

  it('403 for another Origin or none, before any lookup', async () => {
    for (const headers of [{ origin: 'https://evil.example' }, { origin: '' }]) {
      const res = await post(JSON.stringify({ email: 'ana@example.com' }), headers);
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: 'forbidden' });
    }
    expect(adminAuthMock.getUserByEmail).not.toHaveBeenCalled();
  });

  it('404 when sign-in is off', async () => {
    vi.stubEnv('FIREBASE_PROJECT_ID', '');
    const res = await reset('ana@example.com');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
    expect(adminAuthMock.getUserByEmail).not.toHaveBeenCalled();
  });

  it('429 once an IP spends the sign-in budget', async () => {
    adminAuthMock.getUserByEmail.mockRejectedValue(notFound());
    const headers = { 'x-forwarded-for': '203.0.113.77' };
    let last: Response | null = null;
    for (let i = 0; i < 31; i += 1) last = await post(JSON.stringify({ email: 'x@example.com' }), headers);
    expect(last?.status).toBe(429);
  });
});
