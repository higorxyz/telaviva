import { describe, expect, it } from 'vitest';
import { parseEnv } from './env-schema';

describe('parseEnv', () => {
  it('aplica padrões quando só o token existe', () => {
    expect(parseEnv({ TMDB_READ_TOKEN: 'tok' })).toEqual({
      TMDB_READ_TOKEN: 'tok',
      TMDB_API_BASE_URL: 'https://api.themoviedb.org/3',
      SITE_URL: 'https://telaviva.vercel.app',
      TMDB_TIMEOUT_MS: 8000,
    });
  });
  it('aceita um timeout do TMDb configurável e rejeita valores absurdos', () => {
    expect(parseEnv({ TMDB_READ_TOKEN: 'tok', TMDB_TIMEOUT_MS: '60000' }).TMDB_TIMEOUT_MS).toBe(60000);
    expect(() => parseEnv({ TMDB_READ_TOKEN: 'tok', TMDB_TIMEOUT_MS: '5' })).toThrow(/TMDB_TIMEOUT_MS/);
  });
  it('falha com mensagem clara sem token', () => {
    expect(() => parseEnv({})).toThrow(/TMDB_READ_TOKEN/);
  });
});
