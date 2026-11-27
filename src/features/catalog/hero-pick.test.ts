import { describe, expect, it } from 'vitest';
import { movie, tv } from '@/test/media';
import { pickHero, scoreHeroCandidate } from './hero-pick';

const NOW = new Date('2026-11-18T12:00:00Z').getTime();
const longOverview =
  'Uma sinopse bem longa, com mais de cento e quarenta caracteres, para garantir o bônus máximo de sinopse na pontuação do destaque da página inicial do site.';
const good = movie({ id: 1, overview: longOverview, title: 'Bom', backdropPath: '/b.jpg', voteAverage: 8, voteCount: 5000, popularity: 120, releaseDate: '2026-03-01' });
const src = (items: ReturnType<typeof movie>[], sourceBoost = 10, rankBoost = 10) => ({ items, sourceBoost, rankBoost });

describe('scoreHeroCandidate', () => {
  const base = { sourceBoost: 10, rankBonus: 0, sourceCount: 1, now: NOW };
  it('rewards quality, confidence and recency', () => {
    const weak = movie({ voteAverage: 5, voteCount: 5, popularity: 1, releaseDate: '1980-01-01', overview: 'curta' });
    expect(scoreHeroCandidate({ ...base, item: good })).toBeGreaterThan(scoreHeroCandidate({ ...base, item: weak }));
  });
  it('adds 5 points per extra source', () => {
    const one = scoreHeroCandidate({ ...base, item: good });
    expect(scoreHeroCandidate({ ...base, item: good, sourceCount: 3 }) - one).toBeCloseTo(10, 10);
  });
  it('adds the rank bonus as is', () => {
    const one = scoreHeroCandidate({ ...base, item: good });
    expect(scoreHeroCandidate({ ...base, item: good, rankBonus: 13 }) - one).toBeCloseTo(13, 10);
  });
  it('penalizes missing synopsis', () => {
    const short = { ...good, overview: 'x' };
    expect(scoreHeroCandidate({ ...base, item: good }) - scoreHeroCandidate({ ...base, item: short })).toBeCloseTo(14, 10);
  });
});

describe('pickHero', () => {
  it('requires a backdrop', () => {
    const noBackdrop = movie({ id: 2, backdropPath: null, voteAverage: 9, voteCount: 99999, popularity: 500 });
    expect(pickHero([src([noBackdrop, good], 22)], NOW)?.id).toBe(good.id);
  });
  it('returns null without candidates', () => {
    expect(pickHero([src([], 1)], NOW)).toBeNull();
  });
  it('prefers a title present in two sources over a similar one in one', () => {
    const twin = { ...good, id: 3, title: 'Gêmeo' };
    expect(pickHero([src([twin, good]), src([good])], NOW)?.id).toBe(good.id);
  });
  it('lets a top-ranked title with fewer votes beat a lower-ranked one with more votes', () => {
    const top = { ...good, id: 10, voteCount: 800 };
    const low = { ...good, id: 11, voteCount: 1500 };
    // top: rank bonus 13, low at index 12: 1. Confidence gap is only ~2.2 points.
    const filler = Array.from({ length: 11 }, (_, i) => movie({ id: 200 + i, backdropPath: '/f.jpg', voteAverage: 6, voteCount: 1 }));
    expect(pickHero([src([top, ...filler, low], 22, 13)], NOW)?.id).toBe(10);
  });
  it('uses only the first 18 of each source', () => {
    const filler = Array.from({ length: 18 }, (_, i) => movie({ id: 100 + i, backdropPath: '/f.jpg', voteAverage: 6, voteCount: 10 }));
    const star = movie({ id: 9, backdropPath: '/s.jpg', voteAverage: 9, voteCount: 90000, popularity: 300, releaseDate: '2026-01-01' });
    const winner = pickHero([src([...filler, star])], NOW);
    expect(winner?.id).toBe(100);
  });
  it('does not collide movie and series sharing an id', () => {
    const m = movie({ id: 5, backdropPath: '/m.jpg', voteAverage: 6, voteCount: 10 });
    const s = tv({ id: 5, backdropPath: '/s.jpg', voteAverage: 9, voteCount: 9000, releaseDate: '2026-01-01', overview: longOverview });
    const winner = pickHero([src([m]), src([s])], NOW);
    expect(winner?.mediaType).toBe('tv');
  });
});
