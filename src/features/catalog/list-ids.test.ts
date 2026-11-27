import { describe, expect, it } from 'vitest';
import { isCatalogListId } from './list-ids';

describe('isCatalogListId', () => {
  it('accepts known ids', () => {
    expect(isCatalogListId('filmes/populares')).toBe(true);
    expect(isCatalogListId('series/no-ar-hoje')).toBe(true);
  });

  it('rejects unknown ids', () => {
    expect(isCatalogListId('filmes/nao-existe')).toBe(false);
    expect(isCatalogListId('toString')).toBe(false);
  });
});
