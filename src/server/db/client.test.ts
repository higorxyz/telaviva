// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('getDb', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    delete (globalThis as { __telavivaDb?: unknown }).__telavivaDb;
  });

  it('returns the same instance, even after the module is re-evaluated or called at once', async () => {
    vi.stubEnv('DATABASE_DRIVER', 'pglite');
    vi.stubEnv('PGLITE_DIR', '');
    const { getDb } = await import('./client');
    const [first, again] = await Promise.all([getDb(), getDb()]);
    expect(again).toBe(first);
    vi.resetModules();
    const second = await (await import('./client')).getDb();
    expect(second).toBe(first);
  });

  it('rejects with a pt-BR SetupError when no database is configured, and tries again next time', async () => {
    vi.stubEnv('DATABASE_DRIVER', '');
    vi.stubEnv('DATABASE_URL', '');
    vi.resetModules();
    const { getDb } = await import('./client');
    const { SetupError } = await import('@/lib/setup-error');
    await expect(getDb()).rejects.toThrow(/Banco de dados não configurado/);
    await expect(getDb()).rejects.toBeInstanceOf(SetupError);
  });
});
