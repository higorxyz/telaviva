import { afterEach, describe, expect, it, vi } from 'vitest';
import nextConfig from '../../../next.config';

afterEach(() => vi.unstubAllEnvs());

describe('next.config rewrites', () => {
  it('proxies /__/auth to the project firebaseapp.com host', async () => {
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'telaviva-demo');
    const rewrites = await nextConfig.rewrites?.();
    expect(rewrites).toEqual([
      { source: '/__/auth/:path*', destination: 'https://telaviva-demo.firebaseapp.com/__/auth/:path*' },
    ]);
  });

  it('adds no rewrite for a project id that is not a plain host label', async () => {
    for (const bad of ['evil.com/x', 'Telaviva', 'a b', 'x@y']) {
      vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', bad);
      expect(await nextConfig.rewrites?.()).toEqual([]);
    }
  });

  it('adds no rewrite without a project id', async () => {
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', '');
    expect(await nextConfig.rewrites?.()).toEqual([]);
  });
});

describe('next.config build directory', () => {
  async function freshConfig() {
    vi.resetModules();
    return (await import('../../../next.config')).default;
  }

  it('builds into .next with the real tsconfig by default', async () => {
    vi.stubEnv('NEXT_DIST_DIR', '');
    vi.stubEnv('NEXT_TSCONFIG_PATH', '');
    const config = await freshConfig();
    expect(config.distDir).toBe('.next');
    expect(config.typescript?.tsconfigPath).toBe('tsconfig.json');
  });

  it('lets the E2E build use its own directory and tsconfig, so the real .next is never touched', async () => {
    vi.stubEnv('NEXT_DIST_DIR', '.e2e/next');
    vi.stubEnv('NEXT_TSCONFIG_PATH', 'tsconfig.e2e.json');
    const config = await freshConfig();
    expect(config.distDir).toBe('.e2e/next');
    expect(config.typescript?.tsconfigPath).toBe('tsconfig.e2e.json');
  });
});

describe('next.config offline', () => {
  it('turns on useOffline (pending navigations retried when the connection returns), partial prefetching unchanged', () => {
    expect(nextConfig.experimental?.useOffline).toBe(true);
    expect(nextConfig.partialPrefetching).toBe(false);
  });
});
