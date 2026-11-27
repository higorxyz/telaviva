import { describe, expect, it } from 'vitest';
import { parseCommand, parseEnvelope } from './command-schema';
import { LIBRARY_LIMITS } from './limits';

const NOW = '2026-11-20T12:00:00.000Z';
const snapshot = { title: 'Família Soprano', posterPath: null, releaseDate: '1999-01-10', genreIds: [18] };
const tv = { mediaType: 'tv', tmdbId: 1398 } as const;
const movie = { mediaType: 'movie', tmdbId: 550 } as const;
const progress = {
  tvId: 1398,
  ended: true,
  seasons: [{ seasonNumber: 1, episodeCount: 13 }],
  lastAired: { seasonNumber: 1, episodeNumber: 13 },
  nextToAir: null,
};
const item = { ...tv, status: 'watching', addedAt: NOW, updatedAt: NOW, watchedAt: null, snapshot };
const rating = { ...tv, score: 9, ratedAt: NOW, updatedAt: NOW };
const mark = { tvId: 1398, seasonNumber: 1, episodeNumber: 1, watchedAt: NOW };
const marks = (n: number) => Array.from({ length: n }, (_, i) => ({ seasonNumber: 1, episodeNumber: i + 1 }));
const restore = (over: Record<string, unknown> = {}) => ({
  type: 'restore',
  ref: tv,
  item,
  rating,
  marks: [mark],
  ...over,
});

describe('parseCommand', () => {
  it('accepts every command type', () => {
    const commands = [
      { type: 'setStatus', ref: movie, status: 'want', snapshot },
      { type: 'setStatus', ref: tv, status: 'watched', snapshot, progress },
      { type: 'remove', ref: tv },
      { type: 'rate', ref: movie, score: 10, snapshot },
      { type: 'unrate', ref: movie },
      { type: 'setEpisodes', tvId: 1398, marks: marks(2), watched: true, snapshot, progress },
      restore(),
      restore({ item: null, rating: null, marks: [] }),
    ];
    for (const command of commands) expect(parseCommand(command)).toEqual(command);
  });

  it('strips unknown fields at every level', () => {
    const parsed = parseCommand({
      type: 'setStatus',
      ref: { ...movie, extra: 1 },
      status: 'want',
      snapshot: { ...snapshot, overview: 'longo' },
      admin: true,
    });
    expect(parsed).toEqual({ type: 'setStatus', ref: movie, status: 'want', snapshot });
  });

  it('keeps the expected fingerprint on restore, or none', () => {
    const expected = { itemUpdatedAt: NOW, ratingUpdatedAt: null, markCount: 3, latestMarkAt: NOW };
    expect(parseCommand(restore({ expected }))).toMatchObject({ expected });
    expect(parseCommand(restore())).not.toHaveProperty('expected');
    expect(parseCommand(restore({ expected: { ...expected, itemUpdatedAt: 'ontem' } }))).toBeNull();
    expect(parseCommand(restore({ expected: { ...expected, markCount: -1 } }))).toBeNull();
    expect(parseCommand(restore({ expected: { ...expected, markCount: 60_001 } }))).toBeNull();
    expect(parseCommand(restore({ expected: { itemUpdatedAt: NOW } }))).toBeNull();
  });

  it('caps snapshot sizes, so no row can grow without bound', () => {
    const status = (over: Record<string, unknown>) => ({
      type: 'setStatus',
      ref: movie,
      status: 'want',
      snapshot: { ...snapshot, ...over },
    });
    expect(parseCommand(status({ title: 'x'.repeat(300), posterPath: `/${'p'.repeat(199)}`, genreIds: Array(20).fill(18) }))).not.toBeNull();
    expect(parseCommand(status({ title: 'x'.repeat(301) }))).toBeNull();
    expect(parseCommand(status({ posterPath: `/${'p'.repeat(200)}` }))).toBeNull();
    expect(parseCommand(status({ releaseDate: '1999-01-10T00' }))).toBeNull();
    expect(parseCommand(status({ genreIds: Array(21).fill(18) }))).toBeNull();
    expect(parseCommand(status({ genreIds: [0] }))).toBeNull();
    expect(parseCommand(status({ genreIds: [2 ** 31] }))).toBeNull();
  });

  it('refuses numbers a Postgres integer cannot hold (400, not a database error)', () => {
    const big = 2 ** 31;
    expect(parseCommand({ type: 'remove', ref: { mediaType: 'movie', tmdbId: 2 ** 31 - 1 } })).not.toBeNull();
    expect(parseCommand({ type: 'remove', ref: { mediaType: 'movie', tmdbId: big } })).toBeNull();
    const base = { type: 'setEpisodes', tvId: 1398, watched: true, snapshot, progress };
    expect(parseCommand({ ...base, tvId: big })).toBeNull();
    expect(parseCommand({ ...base, marks: [{ seasonNumber: big, episodeNumber: 1 }] })).toBeNull();
    expect(parseCommand({ ...base, marks: [{ seasonNumber: 1, episodeNumber: big }] })).toBeNull();
    expect(parseCommand(restore({ marks: [{ ...mark, episodeNumber: big }] }))).toBeNull();
  });

  it.each([
    ['not an object', 'setStatus'],
    ['null', null],
    ['an unknown type', { type: 'wipe', ref: movie }],
    ['a missing snapshot', { type: 'setStatus', ref: movie, status: 'want' }],
    ['an empty title', { type: 'setStatus', ref: movie, status: 'want', snapshot: { ...snapshot, title: '' } }],
    ['watching for a movie', { type: 'setStatus', ref: movie, status: 'watching', snapshot }],
    ['a bad media type', { type: 'remove', ref: { mediaType: 'person', tmdbId: 1 } }],
    ['a non-integer id', { type: 'remove', ref: { mediaType: 'movie', tmdbId: 1.5 } }],
    ['a score of 11', { type: 'rate', ref: movie, score: 11, snapshot }],
    ['a score of 0', { type: 'rate', ref: movie, score: 0, snapshot }],
    ['a fractional score', { type: 'rate', ref: movie, score: 7.5, snapshot }],
    ['an episode 0 mark', { type: 'setEpisodes', tvId: 1, marks: [{ seasonNumber: 1, episodeNumber: 0 }], watched: true, snapshot, progress }],
  ])('rejects %s', (_label, raw) => {
    expect(parseCommand(raw)).toBeNull();
  });

  it(`allows up to ${LIBRARY_LIMITS.marksPerSetEpisodes} marks per setEpisodes`, () => {
    const base = { type: 'setEpisodes', tvId: 1398, watched: true, snapshot, progress };
    expect(LIBRARY_LIMITS.marksPerSetEpisodes).toBe(2_000);
    expect(parseCommand({ ...base, marks: marks(2_000) })).not.toBeNull();
    expect(parseCommand({ ...base, marks: marks(2_001) })).toBeNull();
  });

  it('refuses a progress with more episodes than a user may ever mark', () => {
    const huge = { ...progress, seasons: [{ seasonNumber: 1, episodeCount: 60_001 }] };
    expect(parseCommand({ type: 'setStatus', ref: tv, status: 'watched', snapshot, progress: huge })).toBeNull();
  });

  it(`caps restore marks at ${LIBRARY_LIMITS.marks}`, () => {
    const many = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ ...mark, seasonNumber: 1 + Math.floor(i / 1000), episodeNumber: 1 + (i % 1000) }));
    expect(parseCommand(restore({ marks: many(60_000) }))).not.toBeNull();
    expect(parseCommand(restore({ marks: many(60_001) }))).toBeNull();
  });

  it('refuses a restore whose item, rating or marks belong to another title', () => {
    expect(parseCommand(restore({ item: { ...item, tmdbId: 1 } }))).toBeNull();
    expect(parseCommand(restore({ item: { ...item, mediaType: 'movie', status: 'want' } }))).toBeNull();
    expect(parseCommand(restore({ rating: { ...rating, tmdbId: 1 } }))).toBeNull();
    expect(parseCommand(restore({ marks: [{ ...mark, tvId: 1 }] }))).toBeNull();
    expect(parseCommand(restore({ ref: movie, item: null, rating: null, marks: [{ ...mark, tvId: 550 }] }))).toBeNull();
  });

  it('refuses an invalid restored row', () => {
    expect(parseCommand(restore({ item: { ...item, updatedAt: 'ontem' } }))).toBeNull();
    expect(parseCommand(restore({ rating: { ...rating, score: 0 } }))).toBeNull();
  });
});

describe('parseEnvelope', () => {
  const command = { type: 'remove', ref: movie };
  const commandId = '0b6f3a8e-4a2c-4d1e-9f7b-2c3d4e5f6a7b';

  it('reads the command alone, as before: no time and no id', () => {
    expect(parseEnvelope({ command })).toEqual({ command });
  });

  it('keeps the time of the action and the command id when they are valid', () => {
    expect(parseEnvelope({ command, at: NOW, commandId })).toEqual({ command, at: NOW, commandId });
    expect(parseEnvelope({ command, at: '2026-11-20T09:00:00.000-03:00' })).toMatchObject({ at: '2026-11-20T09:00:00.000-03:00' });
  });

  it('strips unknown fields of the envelope', () => {
    expect(parseEnvelope({ command, userId: 'someone-else' })).toEqual({ command });
  });

  it.each([
    ['not an object', 'remove'],
    ['an array', [command]],
    ['null', null],
    ['no command', { at: NOW }],
    ['an invalid command', { command: { type: 'wipe' } }],
    ['a time that is not ISO 8601', { command, at: 'ontem' }],
    ['a time without an offset', { command, at: '2026-11-20T12:00:00' }],
    ['a time that is not a string', { command, at: 1_795_000_000_000 }],
    ['a time too long to be one', { command, at: `2026-11-20T12:00:00.${'0'.repeat(60)}Z` }],
    ['an id that is not a uuid', { command, commandId: 'abc' }],
    ['an id with extra text', { command, commandId: `${commandId}x` }],
    ['an id that is not a string', { command, commandId: 42 }],
  ])('refuses %s', (_label, raw) => {
    expect(parseEnvelope(raw)).toBeNull();
  });
});
