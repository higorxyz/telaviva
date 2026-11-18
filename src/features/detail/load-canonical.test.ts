import { beforeEach, describe, expect, it, vi } from 'vitest';

const nav = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error('NOT_FOUND');
  }),
  permanentRedirect: vi.fn(),
}));
vi.mock('next/navigation', () => nav);
vi.mock('@/features/tmdb/client', () => ({
  isTmdbNotFound: (e: unknown) => (e as { status?: number })?.status === 404,
}));

import { loadCanonicalPage } from './load-canonical';

const hrefOf = (m: { id: number; slug: string }) => `/filme/${m.id}-${m.slug}`;
const load = vi.fn(async (id: number) => ({ id, slug: 'clube-da-luta' }));

const run = (slug: string) =>
  loadCanonicalPage({ params: Promise.resolve({ slug }), kind: 'filme', load, hrefOf });

describe('loadCanonicalPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('devolve o item sem redirecionar quando o slug é canônico', async () => {
    await expect(run('550-clube-da-luta')).resolves.toMatchObject({ id: 550 });
    expect(nav.permanentRedirect).not.toHaveBeenCalled();
  });

  it('redireciona (308) quando o slug difere', async () => {
    await run('550');
    expect(nav.permanentRedirect).toHaveBeenCalledWith('/filme/550-clube-da-luta');
  });

  it('404 para slug sem id e para 404 do TMDb', async () => {
    await expect(run('abc')).rejects.toThrow('NOT_FOUND');
    load.mockRejectedValueOnce(Object.assign(new Error('x'), { status: 404 }));
    await expect(run('9-x')).rejects.toThrow('NOT_FOUND');
  });

  it('propaga outros erros', async () => {
    load.mockRejectedValueOnce(new Error('boom'));
    await expect(run('9-x')).rejects.toThrow('boom');
  });
});
