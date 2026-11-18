import { describe, expect, it } from 'vitest';
import { genreHref, mediaHref, parseIdFromSlug, personHref, toSlug } from './slug';

describe('toSlug', () => {
  it('converte títulos em slugs', () => {
    expect(toSlug('Clube da Luta')).toBe('clube-da-luta');
    expect(toSlug('Homem-Aranha: Um Novo Dia')).toBe('homem-aranha-um-novo-dia');
  });
  it('remove diacríticos', () => {
    expect(toSlug('Coração Selvagem')).toBe('coracao-selvagem');
  });
  it('apara espaços e mantém números', () => {
    expect(toSlug('  12 12 12 ')).toBe('12-12-12');
  });
  it('usa "titulo" quando o resultado é vazio', () => {
    expect(toSlug('!!!')).toBe('titulo');
  });
});

describe('parseIdFromSlug', () => {
  it('extrai o ID do prefixo numérico', () => {
    expect(parseIdFromSlug('550-clube-da-luta')).toBe(550);
    expect(parseIdFromSlug('550')).toBe(550);
  });
  it('devolve null para slugs inválidos', () => {
    expect(parseIdFromSlug('abc')).toBeNull();
    expect(parseIdFromSlug('0-x')).toBeNull();
  });
});

describe('hrefs', () => {
  it('mediaHref', () => {
    expect(mediaHref({ mediaType: 'movie', id: 550, title: 'Clube da Luta' })).toBe('/filme/550-clube-da-luta');
    expect(mediaHref({ mediaType: 'tv', id: 1399, title: 'Game of Thrones' })).toBe('/serie/1399-game-of-thrones');
  });
  it('personHref', () => {
    expect(personHref({ id: 287, name: 'Brad Pitt' })).toBe('/pessoa/287-brad-pitt');
  });
  it('genreHref', () => {
    expect(genreHref({ mediaType: 'movie', id: 28, name: 'Ação' })).toBe('/genero/filme/28-acao');
  });
});
