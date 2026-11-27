import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildCustomRoute } from 'next/dist/lib/build-custom-route';
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

describe('next.config security headers', () => {
  type Rule = Awaited<ReturnType<NonNullable<typeof nextConfig.headers>>>[number];

  /** The headers Next would send for `path`: every matching rule in order, a later one overriding an earlier key. */
  async function headersFor(path: string): Promise<Record<string, string>> {
    const rules = (await nextConfig.headers?.()) ?? [];
    const out: Record<string, string> = {};
    for (const rule of rules as Rule[]) {
      if (!new RegExp(buildCustomRoute('header', rule).regex).test(path)) continue;
      for (const { key, value } of rule.headers) out[key] = value;
    }
    return out;
  }

  it('sends nosniff, the referrer policy, the permissions policy and DENY framing on the home page', async () => {
    expect(await headersFor('/')).toMatchObject({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'X-Frame-Options': 'DENY',
    });
  });

  it('sends them on every other page too', async () => {
    for (const path of ['/filme/550-clube-da-luta', '/conta', '/entrar', '/~offline', '/api/library', '/serwist/sw.js']) {
      expect(await headersFor(path)).toMatchObject({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY' });
    }
  });

  it("never blocks framing of Firebase's sign-in helper, which the SDK loads in a hidden iframe of this site", async () => {
    for (const path of ['/__/auth/iframe', '/__/auth/handler', '/__/auth/iframe.js']) {
      const headers = await headersFor(path);
      expect(headers['X-Frame-Options']).toBeUndefined();
      expect(headers['Content-Security-Policy'] ?? '').not.toMatch(/frame-ancestors 'none'/);
      expect(headers['X-Content-Type-Options']).toBe('nosniff');
    }
  });

  it('enforces the Content-Security-Policy on the pages, never only reporting it', async () => {
    const headers = await headersFor('/');
    expect(headers['Content-Security-Policy']).toMatch(/^default-src 'self'; /);
    expect(headers['Content-Security-Policy']).toContain("frame-ancestors 'none'");
    expect(headers).not.toHaveProperty('Content-Security-Policy-Report-Only');
  });

  it("leaves the service worker's own scope header to Serwist", async () => {
    expect(await headersFor('/serwist/sw.js')).not.toHaveProperty('Service-Worker-Allowed');
  });
});
