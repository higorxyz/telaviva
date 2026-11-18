import { describe, expect, it } from 'vitest';
import { parseEnv } from './env-schema';

describe('parseEnv', () => {
  it('aplica padrões quando só o token existe', () => {
    expect(parseEnv({ TMDB_READ_TOKEN: 'tok' })).toEqual({
      TMDB_READ_TOKEN: 'tok',
      TMDB_API_BASE_URL: 'https://api.themoviedb.org/3',
      SITE_URL: 'https://telaviva.vercel.app',
    });
  });
  it('falha com mensagem clara sem token', () => {
    expect(() => parseEnv({})).toThrow(/TMDB_READ_TOKEN/);
  });
});
