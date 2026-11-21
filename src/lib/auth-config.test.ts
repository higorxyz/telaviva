import { afterEach, describe, expect, it, vi } from 'vitest';

const names = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST',
] as const;

async function load(values: Partial<Record<(typeof names)[number], string>>) {
  vi.resetModules();
  for (const name of names) vi.stubEnv(name, values[name] ?? '');
  return import('./auth-config');
}

afterEach(() => vi.unstubAllEnvs());

describe('auth-config', () => {
  it('fica desligado sem nenhuma variável', async () => {
    const mod = await load({});
    expect(mod.publicFirebaseConfig).toBeNull();
    expect(mod.authEnabled).toBe(false);
    expect(mod.authEmulatorHost).toBeNull();
  });
  it('fica desligado com a configuração incompleta', async () => {
    const mod = await load({ NEXT_PUBLIC_FIREBASE_API_KEY: 'k' });
    expect(mod.authEnabled).toBe(false);
  });
  it('monta a configuração pública completa', async () => {
    const mod = await load({
      NEXT_PUBLIC_FIREBASE_API_KEY: 'k',
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'p',
      NEXT_PUBLIC_FIREBASE_APP_ID: 'a',
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'telaviva.vercel.app',
      NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
    });
    expect(mod.publicFirebaseConfig).toEqual({
      apiKey: 'k',
      authDomain: 'telaviva.vercel.app',
      projectId: 'p',
      appId: 'a',
    });
    expect(mod.authEnabled).toBe(true);
    expect(mod.authEmulatorHost).toBe('127.0.0.1:9099');
  });
});

describe('emulator host guard', () => {
  it('counts only the machine itself as local', async () => {
    const { isLocalHostname } = await load({});
    for (const host of ['localhost', 'LOCALHOST', '127.0.0.1', '[::1]', '::1']) expect(isLocalHostname(host)).toBe(true);
    for (const host of ['telaviva.vercel.app', '192.168.0.10', 'localhost.evil.com', '127.0.0.2', '']) {
      expect(isLocalHostname(host)).toBe(false);
    }
  });

  it('allows the emulator on a page served from localhost (the test page is)', async () => {
    const { emulatorAllowedHere } = await load({});
    expect(window.location.hostname).toBe('localhost');
    expect(emulatorAllowedHere()).toBe(true);
  });
});
