import { waitFor } from '@testing-library/react';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { installDefaultApi, probe, renderAuth } from './test-auth';
import { log } from './test-firebase';

// Each test file has its own module registry: these factories run only if something really imports Firebase.
const imported = vi.hoisted(() => [] as string[]);
vi.mock('firebase/app', async () => {
  imported.push('firebase/app');
  return (await import('./test-firebase')).fakeAppModule;
});
vi.mock('firebase/auth', async () => {
  imported.push('firebase/auth');
  return (await import('./test-firebase')).fakeAuthModule;
});
vi.mock('@/lib/auth-config', async () => (await import('./test-firebase')).fakeAuthConfigModule);

afterAll(() => window.localStorage.clear());

describe('AuthProvider without tv_auth', () => {
  it('never imports the Firebase SDK', async () => {
    installDefaultApi();
    renderAuth();
    await waitFor(() => expect(probe()).toBe('guest|-|0'));
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(imported).toEqual([]);
    expect(log).toEqual([]);
  });
});
