// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('getDb', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    delete (globalThis as { __telavivaDb?: unknown }).__telavivaDb;
  });

  it('returns the same instance, even after the module is re-evaluated', async () => {
    vi.stubEnv('DATABASE_DRIVER', 'pglite');
    vi.stubEnv('PGLITE_DIR', '');
    const first = (await import('./client')).getDb();
    vi.resetModules();
    const second = (await import('./client')).getDb();
    expect(second).toBe(first);
  });

  it('throws a pt-BR error when no database is configured', async () => {
    vi.stubEnv('DATABASE_DRIVER', '');
    vi.stubEnv('DATABASE_URL', '');
    vi.resetModules();
    const { getDb } = await import('./client');
    expect(() => getDb()).toThrow(/Banco de dados não configurado/);
  });
});
