import { describe, expect, it } from 'vitest';
import { movie, tv } from '@/test/media';
import { pickHero, scoreHeroCandidate } from './hero-pick';

const NOW = new Date('2026-11-18T12:00:00Z').getTime();
const longOverview = 'Uma sinopse bem longa, com mais de cento e quarenta caracteres, para garantir o bônus máximo de sinopse na pontuação do destaque da página inicial do site.';
const good = movie({ id: 1, overview: longOverview, title: 'Bom', backdropPath: '/b.jpg', voteAverage: 8, voteCount: 5000, popularity: 120, releaseDate: '2026-03-01' });

describe('scoreHeroCandidate', () => {
  const base = { sourceBoost: 10, rank: 0, sourceCount: 1, now: NOW };
  it('rewards quality, confidence and recency', () => {
    const weak = movie({ voteAverage: 5, voteCount: 5, popularity: 1, releaseDate: '1980-01-01', overview: 'curta' });
    expect(scoreHeroCandidate({ ...base, item: good })).toBeGreaterThan(scoreHeroCandidate({ ...base, item: weak }));
  });
  it('adds 5 points per extra source', () => {
    const one = scoreHeroCandidate({ ...base, item: good });
    expect(scoreHeroCandidate({ ...base, item: good, sourceCount: 3 }) - one).toBe(10);
  });
  it('penalizes missing synopsis', () => {
    const short = { ...good, overview: 'x' };
    expect(scoreHeroCandidate({ ...base, item: good }) - scoreHeroCandidate({ ...base, item: short })).toBe(6 + 8);
  });
});

describe('pickHero', () => {
  it('requires a backdrop', () => {
    const noBackdrop = movie({ id: 2, backdropPath: null, voteAverage: 9, voteCount: 99999, popularity: 500 });
    expect(pickHero([{ items: [noBackdrop, good], sourceBoost: 22 }], NOW)?.id).toBe(good.id);
  });
  it('returns null without candidates', () => {
    expect(pickHero([{ items: [], sourceBoost: 1 }], NOW)).toBeNull();
  });
  it('prefers a title present in two sources over a similar one in one', () => {
    const twin = { ...good, id: 3, title: 'Gêmeo' };
    const shared = [{ items: [twin, good], sourceBoost: 10 }, { items: [good], sourceBoost: 10 }];
    expect(pickHero(shared, NOW)?.id).toBe(good.id);
  });
  it('uses only the first 18 of each source', () => {
    const filler = Array.from({ length: 18 }, (_, i) => movie({ id: 100 + i, backdropPath: '/f.jpg', voteAverage: 6, voteCount: 10 }));
    const star = movie({ id: 9, backdropPath: '/s.jpg', voteAverage: 9, voteCount: 90000, popularity: 300, releaseDate: '2026-01-01' });
    expect(pickHero([{ items: [...filler, star], sourceBoost: 10 }], NOW)?.id).not.toBe(9);
  });
  it('does not collide movie and series sharing an id', () => {
    const m = movie({ id: 5, backdropPath: '/m.jpg' });
    const s = tv({ id: 5, backdropPath: '/s.jpg' });
    expect(pickHero([{ items: [m], sourceBoost: 1 }, { items: [s], sourceBoost: 1 }], NOW)).not.toBeNull();
  });
});
