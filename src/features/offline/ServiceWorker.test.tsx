import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ServiceWorker } from './ServiceWorker';

type FakeRegistration = { unregister: ReturnType<typeof vi.fn> };

function fakeBrowser(cacheNames: string[]) {
  const registrations: FakeRegistration[] = [
    { unregister: vi.fn(async () => true) },
    { unregister: vi.fn(async () => true) },
  ];
  const registration = { waiting: null, installing: null, active: null, addEventListener: vi.fn() };
  const serviceWorker = {
    controller: null,
    register: vi.fn(async () => registration),
    getRegistrations: vi.fn(async () => registrations),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  const deleted: string[] = [];
  const caches = {
    keys: vi.fn(async () => cacheNames),
    delete: vi.fn(async (name: string) => (deleted.push(name), true)),
  };
  Object.defineProperty(navigator, 'serviceWorker', { value: serviceWorker, configurable: true });
  vi.stubGlobal('caches', caches);
  return { registrations, serviceWorker, deleted };
}

const CACHE_NAMES = ['tv-pages', 'tv-images', 'serwist-precache-v2-https://telaviva.vercel.app/', 'other-app-cache', 'workbox-x'];

describe('ServiceWorker', () => {
  beforeEach(() => {
    delete (window as Partial<Window>).serwist;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    delete (navigator as { serviceWorker?: unknown }).serviceWorker;
    delete (window as Partial<Window>).serwist;
  });

  it('renders its children', () => {
    vi.stubEnv('NEXT_PUBLIC_SW_DISABLED', '1');
    fakeBrowser([]);
    const { getByText } = render(<ServiceWorker>conteúdo</ServiceWorker>);
    expect(getByText('conteúdo')).toBeInTheDocument();
  });

  it('with NEXT_PUBLIC_SW_DISABLED=1, unregisters every worker and deletes only the tv-* and serwist-* caches', async () => {
    vi.stubEnv('NEXT_PUBLIC_SW_DISABLED', '1');
    const { registrations, serviceWorker, deleted } = fakeBrowser(CACHE_NAMES);
    render(<ServiceWorker>app</ServiceWorker>);

    await waitFor(() => expect(deleted).toHaveLength(3));
    for (const registration of registrations) expect(registration.unregister).toHaveBeenCalledTimes(1);
    expect(deleted.sort()).toEqual(['serwist-precache-v2-https://telaviva.vercel.app/', 'tv-images', 'tv-pages']);
    expect(serviceWorker.register).not.toHaveBeenCalled();
  });

  it('never registers the worker under next dev, and clears one a production run left behind', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const { registrations, serviceWorker, deleted } = fakeBrowser(CACHE_NAMES);
    render(<ServiceWorker>app</ServiceWorker>);

    await waitFor(() => expect(deleted).toHaveLength(3));
    expect(registrations[0].unregister).toHaveBeenCalled();
    expect(serviceWorker.register).not.toHaveBeenCalled();
  });

  it('registers /serwist/sw.js for the whole site otherwise', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { serviceWorker, deleted } = fakeBrowser(CACHE_NAMES);
    render(<ServiceWorker>app</ServiceWorker>);

    await waitFor(() => expect(serviceWorker.register).toHaveBeenCalledTimes(1));
    const [url, options] = serviceWorker.register.mock.calls[0] as unknown as [string | URL, RegistrationOptions];
    expect(String(url)).toMatch(/\/serwist\/sw\.js$/);
    expect(options).toMatchObject({ scope: '/' });
    expect(deleted).toEqual([]);
  });

  it('handles a failed registration: no unhandled rejection, the app keeps working', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { serviceWorker } = fakeBrowser([]);
    serviceWorker.register.mockImplementation(async () => {
      throw new TypeError('registration blocked');
    });
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    try {
      const { getByText } = render(<ServiceWorker>app</ServiceWorker>);
      await waitFor(() => expect(serviceWorker.register).toHaveBeenCalledTimes(1));
      // Unhandled rejections are reported after the microtask queue drains.
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(unhandled).not.toHaveBeenCalled();
      expect(getByText('app')).toBeInTheDocument();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });
});
