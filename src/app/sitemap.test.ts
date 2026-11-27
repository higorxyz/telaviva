import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CATALOG_LIST_META } from '@/features/catalog/list-ids';

const { getGenres } = vi.hoisted(() => ({ getGenres: vi.fn() }));
vi.mock('@/features/tmdb/genres', () => ({ getGenres }));

const SITE = 'https://telaviva.vercel.app';

beforeEach(() => {
  getGenres.mockImplementation(async (media: 'movie' | 'tv') =>
    media === 'movie'
      ? [
          { id: 28, name: 'Ação' },
          { id: 878, name: 'Ficção científica' },
        ]
      : [{ id: 18, name: 'Drama' }],
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function urls(siteUrl?: string): Promise<string[]> {
  if (siteUrl !== undefined) vi.stubEnv('NEXT_PUBLIC_SITE_URL', siteUrl);
  vi.resetModules();
  const sitemap = (await import('./sitemap')).default;
  return (await sitemap()).map((entry) => entry.url);
}

describe('sitemap', () => {
  it('lists the fixed pages and the hubs on the site URL', async () => {
    const list = await urls();
    for (const path of ['', '/filmes', '/series', '/descobrir', '/generos']) {
      expect(list).toContain(`${SITE}${path}`);
    }
    expect(list[0]).toBe(SITE);
  });

  it('lists every catalog list of /filmes and /series', async () => {
    const list = await urls();
    const ids = Object.keys(CATALOG_LIST_META);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(list).toContain(`${SITE}/${id}`);
    expect(list).toContain(`${SITE}/filmes/em-alta`);
    expect(list).toContain(`${SITE}/series/em-alta`);
  });

  it('lists every genre page of both media, with the same slugs as the genre links', async () => {
    const list = await urls();
    expect(list).toContain(`${SITE}/genero/filme/28-acao`);
    expect(list).toContain(`${SITE}/genero/filme/878-ficcao-cientifica`);
    expect(list).toContain(`${SITE}/genero/serie/18-drama`);
    expect(getGenres).toHaveBeenCalledWith('movie');
    expect(getGenres).toHaveBeenCalledWith('tv');
  });

  it('has no account, sign-in, search, personal or per-title page, and no duplicate', async () => {
    const list = await urls();
    const paths = list.map((url) => new URL(url).pathname);
    expect(paths.filter((p) => /^\/(conta|entrar|buscar|minha-lista|api|serwist|~offline|filme\/|serie\/|pessoa)/.test(p))).toEqual([]);
    expect(new Set(list).size).toBe(list.length);
  });

  it('uses the configured site URL', async () => {
    const list = await urls('https://exemplo.dev');
    expect(list[0]).toBe('https://exemplo.dev');
    expect(list.every((url) => url.startsWith('https://exemplo.dev'))).toBe(true);
  });
});
