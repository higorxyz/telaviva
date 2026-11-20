import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { mergeLibraries } from '@/features/library/merge';
import { item, KEY, memStorage, NOW } from '@/features/library/test-storage';
import { EMPTY_LIBRARY, type LibraryState } from '@/features/library/types';
import { server } from '@/test/server';
import { mergeOnLogin, preMergeKey } from './merge-on-login';

const url = `${window.location.origin}/api/library/merge`;
const rating = (tmdbId: number) => ({ mediaType: 'movie', tmdbId, score: 8, ratedAt: NOW, updatedAt: NOW });
const mark = (episodeNumber: number) => ({ tvId: 9, seasonNumber: 1, episodeNumber, watchedAt: NOW });
const guest = {
  version: 1,
  items: [item(1), item(2)],
  episodes: [mark(1), mark(2)],
  ratings: [rating(1)],
};
const raw = JSON.stringify(guest);

let account: LibraryState;
let bodies: { library: LibraryState }[];
let sizes: number[];
const noSleep = async () => {};

/** Behaves like the real route: folds each request into the account and answers the whole account. */
function mergingServer() {
  server.use(
    http.post(url, async ({ request }) => {
      const text = await request.text();
      sizes.push(new TextEncoder().encode(text).length);
      const body = JSON.parse(text) as { library: LibraryState };
      bodies.push(body);
      account = mergeLibraries(account, body.library);
      return HttpResponse.json(account);
    }),
  );
}

beforeEach(() => {
  account = { ...EMPTY_LIBRARY, items: [item(50) as LibraryState['items'][number]] };
  bodies = [];
  sizes = [];
});

describe('mergeOnLogin', () => {
  it('sends nothing when there is no local library or it is empty', async () => {
    mergingServer();
    expect(await mergeOnLogin('u1', { storage: memStorage().storage })).toBe('empty');
    const empty = memStorage({ [KEY]: JSON.stringify(EMPTY_LIBRARY) });
    expect(await mergeOnLogin('u1', { storage: empty.storage })).toBe('empty');
    expect(bodies).toHaveLength(0);
    expect(empty.data[KEY]).toBeDefined();
  });

  it('clears the local copy only after the 200 that holds every guest key, keeping the backup', async () => {
    mergingServer();
    const { storage, data } = memStorage({ [KEY]: raw });
    expect(await mergeOnLogin('u1', { storage })).toBe('merged');
    expect(bodies[0].library.items).toHaveLength(2);
    expect(data[KEY]).toBeUndefined();
    expect(data[preMergeKey('u1')]).toBe(raw);
  });

  it.each([
    ['a 500', () => new HttpResponse(null, { status: 500 })],
    ['a 413 limit', () => HttpResponse.json({ error: 'limit' }, { status: 413 })],
    ['a 413 payload_too_large', () => HttpResponse.json({ error: 'payload_too_large' }, { status: 413 })],
    ['a 401', () => HttpResponse.json({ error: 'unauthenticated' }, { status: 401 })],
  ])('keeps everything local on %s', async (_name, reply) => {
    server.use(http.post(url, reply));
    const { storage, data } = memStorage({ [KEY]: raw });
    expect(await mergeOnLogin('u1', { storage, sleep: noSleep })).toBe('kept');
    expect(data[KEY]).toBe(raw);
    expect(data[preMergeKey('u1')]).toBe(raw);
  });

  it('retries a network error with a bounded backoff, then keeps the copy for the next start', async () => {
    let calls = 0;
    server.use(
      http.post(url, () => {
        calls++;
        return HttpResponse.error();
      }),
    );
    const waits: number[] = [];
    const { storage, data } = memStorage({ [KEY]: raw });
    const result = await mergeOnLogin('u1', { storage, sleep: async (ms) => void waits.push(ms) });
    expect(result).toBe('kept');
    expect(calls).toBe(3);
    expect(waits).toHaveLength(2);
    expect(data[KEY]).toBe(raw);
  });

  it('merges when a retry after a network error succeeds', async () => {
    let failed = false;
    server.use(
      http.post(url, async ({ request }) => {
        if (!failed) {
          failed = true;
          return HttpResponse.error();
        }
        const body = (await request.json()) as { library: LibraryState };
        return HttpResponse.json(mergeLibraries(account, body.library));
      }),
    );
    const { storage, data } = memStorage({ [KEY]: raw });
    expect(await mergeOnLogin('u1', { storage, sleep: noSleep })).toBe('merged');
    expect(data[KEY]).toBeUndefined();
  });

  it('writes the backup once and never replaces an existing one', async () => {
    mergingServer();
    const { storage, data } = memStorage({ [KEY]: raw, [preMergeKey('u1')]: 'older' });
    await mergeOnLogin('u1', { storage });
    expect(data[preMergeKey('u1')]).toBe('older');
  });

  it('keeps the copy when the answer lacks a guest key (items, ratings or marks)', async () => {
    for (const drop of ['items', 'ratings', 'episodes'] as const) {
      server.use(
        http.post(url, async ({ request }) => {
          const body = (await request.json()) as { library: LibraryState };
          const merged = mergeLibraries(account, body.library);
          const rows = merged[drop] as { tmdbId?: number; episodeNumber?: number }[];
          const lost = rows.filter((row) => (row.tmdbId ?? row.episodeNumber) !== 1);
          return HttpResponse.json({ ...merged, [drop]: lost });
        }),
      );
      const { storage, data } = memStorage({ [KEY]: raw });
      expect(await mergeOnLogin('u1', { storage, sleep: noSleep })).toBe('kept');
      expect(data[KEY]).toBe(raw);
    }
  });

  it('splits a large library into chunks of disjoint keys and clears only after the last one', async () => {
    mergingServer();
    const { storage, data } = memStorage({ [KEY]: raw });
    expect(await mergeOnLogin('u1', { storage, chunkBytes: 400 })).toBe('merged');
    expect(bodies.length).toBeGreaterThan(1);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(400);
    const sent = bodies.flatMap((b) => [
      ...b.library.items.map((i) => `i:${i.tmdbId}`),
      ...b.library.ratings.map((r) => `r:${r.tmdbId}`),
      ...b.library.episodes.map((e) => `e:${e.episodeNumber}`),
    ]);
    expect(sent.sort()).toEqual(['e:1', 'e:2', 'i:1', 'i:2', 'r:1']);
    expect(data[KEY]).toBeUndefined();
  });

  it('keeps the whole local copy when a later chunk fails', async () => {
    let calls = 0;
    server.use(
      http.post(url, async ({ request }) => {
        calls++;
        if (calls === 2) return new HttpResponse(null, { status: 500 });
        const body = (await request.json()) as { library: LibraryState };
        account = mergeLibraries(account, body.library);
        return HttpResponse.json(account);
      }),
    );
    const { storage, data } = memStorage({ [KEY]: raw });
    expect(await mergeOnLogin('u1', { storage, chunkBytes: 400, sleep: noSleep })).toBe('kept');
    expect(data[KEY]).toBe(raw);
  });

  it('does not clear a local copy that another tab changed during the merge', async () => {
    const { storage, data } = memStorage({ [KEY]: raw });
    server.use(
      http.post(url, async ({ request }) => {
        data[KEY] = JSON.stringify({ ...guest, items: [...guest.items, item(3)] });
        const body = (await request.json()) as { library: LibraryState };
        return HttpResponse.json(mergeLibraries(account, body.library));
      }),
    );
    expect(await mergeOnLogin('u1', { storage })).toBe('merged');
    expect(JSON.parse(data[KEY]).items).toHaveLength(3);
  });

  it('keeps every request under the 2 MB route limit with the default chunk size', async () => {
    mergingServer();
    const long = 'Título com acentuação é ç ã '.repeat(10).slice(0, 300);
    const items = Array.from({ length: 6000 }, (_, i) => item(i + 1, `${long}${i}`.slice(0, 300)));
    const { storage, data } = memStorage({ [KEY]: JSON.stringify({ ...EMPTY_LIBRARY, items }) });
    expect(await mergeOnLogin('u2', { storage })).toBe('merged');
    expect(bodies.length).toBeGreaterThan(1);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(1.5 * 1024 * 1024);
    expect(data[KEY]).toBeUndefined();
  });
});
