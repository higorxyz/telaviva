import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MediaSummary, Paginated } from '@/features/tmdb/types';
import { movie } from '@/test/media';
import { fetchFilledPage, fetchRailPage } from './post-filter-pages';

const page = (n: number, ids: number[], totalPages = 10): Paginated<MediaSummary> => ({
  page: n,
  totalPages,
  totalResults: totalPages * 20,
  results: ids.map((id) => movie({ id })),
});
const ids = (p: Paginated<MediaSummary>) => p.results.map((r) => r.id);

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('fetchRailPage', () => {
  it('keeps page 1 alone when it has at least 12 titles', async () => {
    const fetch = vi.fn(async (n: number) => page(n, Array.from({ length: 12 }, (_, i) => n * 100 + i)));
    const result = await fetchRailPage(fetch);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.results).toHaveLength(12);
  });

  it('tops up from page 2 when page 1 has fewer than 12, without repeating titles', async () => {
    const fetch = vi.fn(async (n: number) => (n === 1 ? page(1, [1, 2, 3]) : page(2, [3, 4, 5])));
    const result = await fetchRailPage(fetch);
    expect(fetch.mock.calls.map(([n]) => n)).toEqual([1, 2]);
    expect(ids(result)).toEqual([1, 2, 3, 4, 5]);
    expect(result.page).toBe(1);
  });

  it('does not ask page 2 of a one-page list, and keeps page 1 when page 2 fails', async () => {
    const single = vi.fn(async () => page(1, [1, 2], 1));
    expect(ids(await fetchRailPage(single))).toEqual([1, 2]);
    expect(single).toHaveBeenCalledTimes(1);

    const flaky = vi.fn(async (n: number) => {
      if (n === 2) throw new Error('boom');
      return page(1, [1, 2]);
    });
    expect(ids(await fetchRailPage(flaky))).toEqual([1, 2]);
  });

  it('lets a page 1 failure through, so the rail is dropped', async () => {
    await expect(fetchRailPage(async () => Promise.reject(new Error('down')))).rejects.toThrow('down');
  });
});

describe('fetchFilledPage', () => {
  it('returns a page with titles as is', async () => {
    const fetch = vi.fn(async (n: number) => page(n, [n]));
    expect(await fetchFilledPage(fetch, 4)).toEqual(page(4, [4]));
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('skips empty pages and reports the page actually used', async () => {
    const fetch = vi.fn(async (n: number) => page(n, n < 3 ? [] : [n * 10]));
    const result = await fetchFilledPage(fetch, 1);
    expect(fetch.mock.calls.map(([n]) => n)).toEqual([1, 2, 3]);
    expect(result).toMatchObject({ page: 3, totalPages: 10 });
    expect(ids(result)).toEqual([30]);
  });

  it('tries the next page at most 3 times, then returns the last empty page so scrolling moves on', async () => {
    const fetch = vi.fn(async (n: number) => page(n, []));
    const result = await fetchFilledPage(fetch, 2);
    expect(fetch.mock.calls.map(([n]) => n)).toEqual([2, 3, 4, 5]);
    expect(result).toMatchObject({ page: 5, totalPages: 10, results: [] });
  });

  it('stops at the last page, so infinite scroll ends', async () => {
    const fetch = vi.fn(async (n: number) => page(n, [], 3));
    const result = await fetchFilledPage(fetch, 2);
    expect(fetch.mock.calls.map(([n]) => n)).toEqual([2, 3]);
    expect(result.page).toBeGreaterThanOrEqual(result.totalPages);
  });

  it('keeps the empty page it has when a later page fails', async () => {
    const fetch = vi.fn(async (n: number) => {
      if (n === 3) throw new Error('boom');
      return page(n, []);
    });
    expect(await fetchFilledPage(fetch, 2)).toMatchObject({ page: 2, results: [] });
  });

  it('never asks beyond page 500 (the TMDb limit)', async () => {
    const fetch = vi.fn(async (n: number) => page(n, [], 900));
    const result = await fetchFilledPage(fetch, 499);
    expect(fetch.mock.calls.map(([n]) => n)).toEqual([499, 500]);
    expect(result.page).toBe(500);
  });
});
