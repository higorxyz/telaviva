import { describe, expect, it } from 'vitest';
import { filtersToSearchParams, parseFilters } from './filters';
import { clearDimension, flip, isOn, presets, summary, yearPicks } from './toolbar-model';

const parse = (qs: string) => parseFilters(new URLSearchParams(qs));
const qs = (f: ReturnType<typeof parse>) => filtersToSearchParams(f).toString();
const preset = (id: string) => presets(2026).find((p) => p.id === id)!;
const pick = (id: string) => yearPicks(2026).find((p) => p.id === id)!;

describe('presets', () => {
  it('map to the exact URL params of the brief and merge with the current filters', () => {
    expect(qs(flip(parse('generos=18'), preset('aclamados')))).toBe('generos=18&nota=8&votos=1000&ordem=nota');
    expect(qs(flip(parse(''), preset('curtos')))).toBe('votos=100&duracao=100');
    expect(qs(flip(parse(''), preset('lancamentos')))).toBe('de=2026&ate=2026');
    expect(preset('lancamentos').label).toBe('Lançamentos 2026');
  });

  it('are on only while the filters match, and turn off by removing what they set', () => {
    const on = parse('nota=8&votos=1000&ordem=nota&generos=18');
    expect(isOn(on, preset('aclamados'))).toBe(true);
    expect(isOn(parse('nota=8&votos=500&ordem=nota'), preset('aclamados'))).toBe(false);
    expect(qs(flip(on, preset('aclamados')))).toBe('generos=18');
  });

  it('marks the runtime preset as movie only', () => {
    expect(presets(2026).filter((p) => p.movieOnly).map((p) => p.id)).toEqual(['curtos']);
  });
});

describe('year quick picks', () => {
  it('set decades, this year and the classics', () => {
    expect(qs(flip(parse(''), pick('anos-2010')))).toBe('de=2010&ate=2019');
    expect(qs(flip(parse(''), pick('anos-2000')))).toBe('de=2000&ate=2009');
    expect(qs(flip(parse('de=1950'), pick('classicos')))).toBe('ate=1979');
    expect(qs(flip(parse(''), pick('este-ano')))).toBe('de=2026&ate=2026');
  });

  it('toggle off back to any year', () => {
    expect(isOn(parse('ate=1979'), pick('classicos'))).toBe(true);
    expect(isOn(parse('de=1950&ate=1979'), pick('classicos'))).toBe(false);
    expect(qs(flip(parse('de=2010&ate=2019'), pick('anos-2010')))).toBe('');
  });
});

describe('summary', () => {
  it('describes each active dimension briefly and is null when unset', () => {
    const f = parse('generos=18,28&de=2010&ate=2019&nota=7.5&duracao=90&provedores=8&idioma=ko&votos=100');
    expect(summary('generos', f)).toBe('2');
    expect(summary('ano', f)).toBe('2010–2019');
    expect(summary('nota', f)).toBe('7,5+');
    expect(summary('duracao', f)).toBe('até 90 min');
    expect(summary('provedores', f)).toBe('1');
    expect(summary('mais', f)).toBe('2');
    const empty = parse('');
    for (const d of ['generos', 'ano', 'nota', 'duracao', 'provedores', 'mais'] as const) expect(summary(d, empty)).toBeNull();
  });

  it('words open and single-year ranges', () => {
    expect(summary('ano', parse('de=2026&ate=2026'))).toBe('2026');
    expect(summary('ano', parse('de=1990'))).toBe('desde 1990');
    expect(summary('ano', parse('ate=1979'))).toBe('até 1979');
    expect(summary('nota', parse('nota=8'))).toBe('8+');
  });
});

describe('clearDimension', () => {
  it('resets only that dimension', () => {
    const f = parse('generos=18&de=2010&ate=2019&nota=8&idioma=ko&votos=100&provedores=8&ordem=nota');
    expect(qs(clearDimension('ano', f))).toBe('generos=18&nota=8&votos=100&idioma=ko&provedores=8&ordem=nota');
    expect(qs(clearDimension('mais', f))).toBe('generos=18&de=2010&ate=2019&nota=8&provedores=8&ordem=nota');
    expect(clearDimension('generos', f).genres).toEqual([]);
  });
});
