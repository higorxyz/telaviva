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

  it('adds no rewrite without a project id', async () => {
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', '');
    expect(await nextConfig.rewrites?.()).toEqual([]);
  });
});
