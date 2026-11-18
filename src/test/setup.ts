import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { server } from './server';

// 'use cache' is inert outside the Next compiler; these are only imported by cached functions.
vi.mock('next/cache', () => ({ cacheLife: () => {}, cacheTag: () => {} }));

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  server.resetHandlers();
  cleanup();
});
afterAll(() => server.close());
