import { vi } from 'vitest';

/**
 * `next/navigation` for the account tests. Wire it in with:
 *   vi.mock('next/navigation', async () => (await import('./test-nav')).navigationModule);
 */
export const nav = { replace: vi.fn(), push: vi.fn() };
export const navigationModule = {
  useRouter: () => ({ replace: nav.replace, push: nav.push, prefetch: vi.fn() }),
};
