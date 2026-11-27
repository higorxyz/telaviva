import { afterEach, describe, expect, it, vi } from 'vitest';

/** The worker Serwist would bundle: its precache list is injected into it. */
const FULL_WORKER = 'self.__SW_MANIFEST=[{"url":"/","revision":"r1"}];importScripts("serwist");';

vi.mock('next/cache', () => ({ cacheLife: vi.fn() }));
vi.mock('@serwist/turbopack', () => ({
  createSerwistRoute: () => ({
    generateStaticParams: () => [{ path: 'sw.js' }, { path: 'sw.js.map' }],
    dynamicParams: false,
    GET: vi.fn(
      async (_request: Request, { params }: { params: Promise<{ path: string }> }) =>
        new Response((await params).path === 'sw.js' ? FULL_WORKER : '{"version":3}', {
          headers: { 'Content-Type': 'application/javascript' },
        }),
    ),
  }),
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function get(path: string, disabled: boolean) {
  if (disabled) vi.stubEnv('NEXT_PUBLIC_SW_DISABLED', '1');
  vi.resetModules();
  const { GET } = await import('./route');
  return GET(new Request(`http://localhost/serwist/${path}`), { params: Promise.resolve({ path }) } as never);
}

describe('/serwist/[path]', () => {
  it('serves the worker Serwist built, allowed to control the whole site', async () => {
    const response = await get('sw.js', false);
    expect(await response.text()).toBe(FULL_WORKER);
    expect(response.headers.get('Service-Worker-Allowed')).toBe('/');
  });

  it('with NEXT_PUBLIC_SW_DISABLED=1, serves a worker that removes itself instead, with no precache list', async () => {
    const response = await get('sw.js', true);
    const body = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toMatch(/javascript/);
    expect(response.headers.get('Service-Worker-Allowed')).toBe('/');
    expect(body).toContain('unregister');
    expect(body).not.toContain('__SW_MANIFEST');
    expect(body).not.toContain('precache');
    expect(body).not.toContain("'fetch'");
  });

  it('with NEXT_PUBLIC_SW_DISABLED=1, the source map is not there', async () => {
    expect((await get('sw.js.map', true)).status).toBe(404);
  });
});

/** A worker global: its listeners, the caches and the clients it sees. */
function workerScope(cacheNames: string[]) {
  const listeners = new Map<string, (event: { waitUntil(promise: Promise<unknown>): void }) => void>();
  const kept = new Set(cacheNames);
  const log: string[] = [];
  const windows = [
    { url: 'https://telaviva.app/minha-lista', navigate: vi.fn(async (url: string) => void log.push(`navigate ${url}`)) },
    { url: 'https://telaviva.app/filmes', navigate: vi.fn(async (url: string) => void log.push(`navigate ${url}`)) },
  ];
  const self = {
    addEventListener: (type: string, listener: (event: { waitUntil(promise: Promise<unknown>): void }) => void) =>
      listeners.set(type, listener),
    skipWaiting: vi.fn(async () => void log.push('skipWaiting')),
    registration: { unregister: vi.fn(async () => (log.push('unregister'), true)) },
    clients: {
      claim: vi.fn(async () => void log.push('claim')),
      matchAll: vi.fn(async (options: unknown) => (log.push(`matchAll ${JSON.stringify(options)}`), windows)),
    },
  };
  const caches = {
    keys: async () => [...kept],
    delete: async (name: string) => (log.push(`delete ${name}`), kept.delete(name)),
  };
  async function dispatch(type: string) {
    const waited: Promise<unknown>[] = [];
    listeners.get(type)?.({ waitUntil: (promise) => void waited.push(promise) });
    await Promise.all(waited);
  }
  return { self, caches, kept, log, listeners, dispatch };
}

describe('the self-removing worker', () => {
  it('takes over at once, deletes only its own caches, unregisters and reloads every open window', async () => {
    const { KILL_SWITCH_WORKER } = await import('@/sw/kill-switch');
    const scope = workerScope(['tv-pages', 'tv-images', 'serwist-precache-v2', 'other-site-cache']);
    new Function('self', 'caches', KILL_SWITCH_WORKER)(scope.self, scope.caches);
    expect([...scope.listeners.keys()].sort()).toEqual(['activate', 'install']);

    await scope.dispatch('install');
    expect(scope.self.skipWaiting).toHaveBeenCalled();

    await scope.dispatch('activate');
    expect([...scope.kept]).toEqual(['other-site-cache']);
    expect(scope.log.slice(-5)).toEqual([
      'claim',
      'unregister',
      'matchAll {"type":"window"}',
      'navigate https://telaviva.app/minha-lista',
      'navigate https://telaviva.app/filmes',
    ]);
  });

  it('a window that cannot be navigated does not stop the others', async () => {
    const { KILL_SWITCH_WORKER } = await import('@/sw/kill-switch');
    const scope = workerScope([]);
    const windows = await scope.self.clients.matchAll({});
    windows[0]!.navigate.mockRejectedValueOnce(new TypeError('not controlled'));
    new Function('self', 'caches', KILL_SWITCH_WORKER)(scope.self, scope.caches);
    await scope.dispatch('activate');
    expect(windows[1]!.navigate).toHaveBeenCalledWith('https://telaviva.app/filmes');
  });
});
