import { describe, expect, it, vi } from 'vitest';

const config = vi.hoisted(() => ({ authEnabled: true }));
vi.mock('@/lib/auth-config', () => ({
  get authEnabled() {
    return config.authEnabled;
  },
  publicFirebaseConfig: null,
  authEmulatorHost: null,
}));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_HTTP_ERROR_FALLBACK;404');
  },
}));
vi.mock('@/features/auth/SignInView', () => ({ SignInView: () => null }));

import EntrarPage, { metadata } from './page';

describe('/entrar', () => {
  it('is titled "Entrar" and kept out of search engines', () => {
    expect(metadata.title).toBe('Entrar');
    expect(metadata.robots).toEqual({ index: false });
  });

  it('does not exist with sign-in off', () => {
    config.authEnabled = false;
    expect(() => EntrarPage()).toThrow('NEXT_HTTP_ERROR_FALLBACK;404');
    config.authEnabled = true;
    expect(() => EntrarPage()).not.toThrow();
  });
});
