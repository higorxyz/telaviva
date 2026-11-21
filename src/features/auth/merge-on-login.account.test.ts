import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { mergeLibraries } from '@/features/library/merge';
import { item, KEY, memStorage } from '@/features/library/test-storage';
import { EMPTY_LIBRARY, type LibraryState } from '@/features/library/types';
import { server } from '@/test/server';
import { confirmedKey, mergeOnLogin } from './merge-on-login';

const url = `${window.location.origin}/api/library/merge`;
const raw = JSON.stringify({ version: 1, items: [item(1), item(2), item(3), item(4)], episodes: [], ratings: [] });

describe('mergeOnLogin: the account it merges into', () => {
  it('names that account in X-Expected-User on every chunk', async () => {
    const seen: (string | null)[] = [];
    let account: LibraryState = EMPTY_LIBRARY;
    server.use(
      http.post(url, async ({ request }) => {
        seen.push(request.headers.get('x-expected-user'));
        account = mergeLibraries(account, ((await request.json()) as { library: LibraryState }).library);
        return HttpResponse.json(account);
      }),
    );
    const { storage } = memStorage({ [KEY]: raw });
    expect(await mergeOnLogin('ana', { storage, chunkBytes: 400 })).toBe('merged');
    expect(seen.length).toBeGreaterThan(1);
    expect(new Set(seen)).toEqual(new Set(['ana']));
  });

  it('stops at a 409 wrong_account (another tab switched accounts), keeping the whole local copy', async () => {
    let calls = 0;
    server.use(
      http.post(url, () => {
        calls++;
        return HttpResponse.json({ error: 'wrong_account' }, { status: 409 });
      }),
    );
    const { storage, data } = memStorage({ [KEY]: raw });
    expect(await mergeOnLogin('ana', { storage, chunkBytes: 400 })).toBe('wrong_account');
    expect(calls).toBe(1);
    expect(data[KEY]).toBe(raw);
    expect(data[confirmedKey('ana')]).toBeUndefined();
  });
});
