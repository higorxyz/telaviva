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
vi.mock('@/features/auth/AccountView', () => ({ AccountView: () => null }));

import ContaPage, { metadata } from './page';

describe('/conta', () => {
  it('is titled "Sua conta" and kept out of search engines', () => {
    expect(metadata.title).toBe('Sua conta');
    expect(metadata.robots).toEqual({ index: false });
  });

  it('does not exist with sign-in off', () => {
    config.authEnabled = false;
    expect(() => ContaPage()).toThrow('NEXT_HTTP_ERROR_FALLBACK;404');
    config.authEnabled = true;
    expect(() => ContaPage()).not.toThrow();
  });
});
