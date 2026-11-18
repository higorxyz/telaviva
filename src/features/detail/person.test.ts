import { describe, expect, it } from 'vitest';
import { movie } from '@/test/media';
import type { PersonCredit } from '@/features/tmdb/types';
import { age, departmentLabel, filmography, knownFor, splitCredits } from './person';

const credit = (o: Partial<PersonCredit> = {}): PersonCredit => ({
  ...movie(),
  role: '',
  department: 'Acting',
  ...o,
});
const score = (c: PersonCredit) => c.voteCount * 0.6 + c.popularity * 0.4;
const byScore = (a: PersonCredit, b: PersonCredit) => score(b) - score(a);

describe('age', () => {
  it('computes age today and at death', () => {
    expect(age('1963-12-18', null, new Date('2026-11-18'))).toBe(62);
    expect(age('1963-12-18', null, new Date('2026-12-18'))).toBe(63);
    expect(age('1950-01-01', '2000-06-01')).toBe(50);
  });
});

describe('departmentLabel', () => {
  it('maps known departments and passes others through', () => {
    expect(departmentLabel('Directing')).toBe('Direção');
    expect(departmentLabel('Costume & Make-Up')).toBe('Figurino e maquiagem');
    expect(departmentLabel('Lighting')).toBe('Lighting');
  });
});

describe('knownFor', () => {
  it('dedupes by media type and id, requires a poster and sorts by score', () => {
    const dup = credit({ id: 1, voteCount: 500, popularity: 50 });
    const dupCrew = credit({ id: 1, voteCount: 500, popularity: 50, role: 'Producer', department: 'Production' });
    const noPoster = credit({ id: 2, posterPath: null, voteCount: 9999 });
    const good = credit({ id: 3, voteCount: 10, popularity: 5 });
    const show = credit({ id: 1, mediaType: 'tv', voteCount: 100, popularity: 1 });
    const result = knownFor([dup, dupCrew, noPoster, good, show]);
    expect(result).toEqual([dup, show, good].sort(byScore));
    expect(knownFor([dup, good], 1)).toEqual([dup]);
  });
});

describe('filmography', () => {
  it('groups by year descending with undated last', () => {
    const y2020 = credit({ id: 1, releaseDate: '2020-05-01' });
    const y1999 = credit({ id: 2, releaseDate: '1999-01-01' });
    const noDate = credit({ id: 3, releaseDate: null });
    expect(filmography([noDate, y1999, y2020]).map((g) => g.year)).toEqual(['2020', '1999', 'Sem data']);
  });

  it('merges repeated titles, joining the roles', () => {
    const a = credit({ id: 1, role: 'Produtor', department: 'Production' });
    const b = credit({ id: 1, role: 'Diretor', department: 'Directing' });
    const c = credit({ id: 1, role: 'Produtor', department: 'Production' });
    const other = credit({ id: 1, mediaType: 'tv', role: 'Ele mesmo' });
    const items = filmography([a, b, c, other])[0]!.items;
    expect(items).toHaveLength(2);
    expect(items.find((i) => i.mediaType === 'movie')!.role).toBe('Produtor, Diretor');
  });
});

describe('splitCredits', () => {
  it('splits acting from crew', () => {
    const act = credit({ id: 1 });
    const crew = credit({ id: 2, department: 'Directing' });
    expect(splitCredits([act, crew])).toEqual({ all: [act, crew], acting: [act], crew: [crew] });
  });
});
