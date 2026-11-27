import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { server } from './server';

// Async queries/waitFor get generous timeouts so loaded CI machines don't flake.
configure({ asyncUtilTimeout: 5000 });

// 'use cache' is inert outside the Next compiler; these are only imported by cached functions.
vi.mock('next/cache', () => ({ cacheLife: () => {}, cacheTag: () => {} }));

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  server.resetHandlers();
  cleanup();
});
afterAll(() => server.close());
