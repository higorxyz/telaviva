import { describe, expect, it } from 'vitest';
import { isActive, NAV_ITEMS, TAB_ITEMS } from './nav';

describe('nav', () => {
  it('isActive', () => {
    expect(isActive('/', '/')).toBe(true);
    expect(isActive('/filmes/populares', '/')).toBe(false);
    expect(isActive('/filme/550-x', '/filmes')).toBe(true);
    expect(isActive('/serie/1-x', '/series')).toBe(true);
    expect(isActive('/filmes', '/filmes')).toBe(true);
    expect(isActive('/series', '/filmes')).toBe(false);
  });
  it('items', () => {
    expect(NAV_ITEMS).toHaveLength(5);
    expect(TAB_ITEMS.map((i) => i.href)).toEqual(['/', '/filmes', '/series', '/buscar', '/minha-lista']);
  });
});
