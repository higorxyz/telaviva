import { beforeEach, describe, expect, it, vi } from 'vitest';

const permanentRedirect = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ permanentRedirect }));

import { assertCanonical, resolveCanonical } from './canonical';

describe('resolveCanonical', () => {
  it('extrai o id do slug', () => {
    expect(resolveCanonical({ slug: '550-clube-da-luta' }, 'filme')).toEqual({ id: 550 });
    expect(resolveCanonical({ slug: '550' }, 'serie')).toEqual({ id: 550 });
  });

  it('devolve not-found para slug sem id válido', () => {
    expect(resolveCanonical({ slug: 'abc' }, 'filme')).toBe('not-found');
    expect(resolveCanonical({ slug: '0-x' }, 'pessoa')).toBe('not-found');
    expect(resolveCanonical({ slug: '' }, 'filme')).toBe('not-found');
  });
});

describe('assertCanonical', () => {
  beforeEach(() => permanentRedirect.mockReset());

  it('redireciona (308) quando o slug difere da URL canônica', () => {
    assertCanonical('550', '/filme/550-clube-da-luta');
    expect(permanentRedirect).toHaveBeenCalledWith('/filme/550-clube-da-luta');
  });

  it('não redireciona quando já é canônico', () => {
    assertCanonical('550-clube-da-luta', '/filme/550-clube-da-luta');
    expect(permanentRedirect).not.toHaveBeenCalled();
  });

  it('compara o slug decodificado', () => {
    assertCanonical('550-clube-da-luta', '/filme/550-clube-da-luta');
    assertCanonical(encodeURIComponent('550-clube-da-luta'), '/filme/550-clube-da-luta');
    expect(permanentRedirect).not.toHaveBeenCalled();
  });
});
