import { describe, expect, it } from 'vitest';
import { formatDate, formatRating, formatRuntime, formatYear, splitAccent } from './format';

describe('formatRating', () => {
  it('usa vírgula e uma casa decimal', () => {
    expect(formatRating(8)).toBe('8,0');
    expect(formatRating(7.25)).toBe('7,3');
  });
});

describe('formatRuntime', () => {
  it('formata horas e minutos', () => {
    expect(formatRuntime(139)).toBe('2h 19min');
    expect(formatRuntime(45)).toBe('45min');
    expect(formatRuntime(120)).toBe('2h');
  });
  it('devolve null para zero', () => {
    expect(formatRuntime(0)).toBeNull();
  });
});

describe('formatDate / formatYear', () => {
  it('formata data em pt-BR', () => {
    expect(formatDate('2026-07-17')).toBe('17 de jul. de 2026');
    expect(formatDate(null)).toBeNull();
  });
  it('extrai o ano', () => {
    expect(formatYear('1999-10-15')).toBe('1999');
  });
});

describe('splitAccent', () => {
  it('destaca a última palavra', () => {
    expect(splitAccent('A Odisseia')).toEqual({ lead: 'A', accent: 'Odisseia' });
    expect(splitAccent('Duna')).toEqual({ lead: 'Duna', accent: null });
  });
  it('divide no dois-pontos', () => {
    expect(splitAccent('Homem-Aranha: Um Novo Dia')).toEqual({ lead: 'Homem-Aranha:', accent: 'Um Novo Dia' });
    expect(splitAccent('O Senhor dos Anéis: Os Anéis de Poder')).toEqual({
      lead: 'O Senhor dos Anéis:',
      accent: 'Os Anéis de Poder',
    });
  });
});
