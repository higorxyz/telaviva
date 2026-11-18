import { describe, expect, it } from 'vitest';
import { pageMeta } from './page-meta';

describe('pageMeta', () => {
  it('fills title, description, canonical and openGraph consistently', () => {
    const m = pageMeta({ title: 'Filmes', description: 'Desc.', path: '/filmes' });
    expect(m).toMatchObject({
      title: 'Filmes',
      description: 'Desc.',
      alternates: { canonical: '/filmes' },
      openGraph: { type: 'website', title: 'Filmes', description: 'Desc.', url: '/filmes' },
    });
  });

  it('supports an absolute title and noindex', () => {
    const m = pageMeta({ title: { absolute: 'TelaViva' }, description: 'D', path: '/', noindex: true });
    expect(m.title).toEqual({ absolute: 'TelaViva' });
    expect(m.robots).toEqual({ index: false });
    expect(m.openGraph).toMatchObject({ title: 'TelaViva' });
  });
});
