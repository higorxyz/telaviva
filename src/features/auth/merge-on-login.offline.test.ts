import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { item, KEY, memStorage } from '@/features/library/test-storage';
import { EMPTY_LIBRARY, type LibraryState } from '@/features/library/types';
import { server } from '@/test/server';
import { whenOnline } from '@/features/offline/when-online';
import { mergeOnLogin } from './merge-on-login';

const url = `${window.location.origin}/api/library/merge`;
const raw = JSON.stringify({ ...EMPTY_LIBRARY, items: [item(1)] });
let sent: number;

beforeEach(() => {
  sent = 0;
  server.use(
    http.post(url, async ({ request }) => {
      sent += 1;
      const { library } = (await request.json()) as { library: LibraryState };
      return HttpResponse.json(library);
    }),
  );
});
afterEach(() => {
  vi.restoreAllMocks();
});

const tick = () => new Promise((resolve) => setTimeout(resolve, 10));

describe('mergeOnLogin without a connection', () => {
  it('waits for the connection before sending anything, and the copy stays intact until then', async () => {
    const { storage, data } = memStorage({ [KEY]: raw });
    let online: (goOn: boolean) => void = () => {};
    const merging = mergeOnLogin('u1', { storage, whenOnline: () => new Promise((resolve) => (online = resolve)) });
    await tick();
    expect(sent).toBe(0);
    expect(data[KEY]).toBe(raw);
    online(true);
    expect(await merging).toBe('merged');
    expect(sent).toBe(1);
    expect(data[KEY]).toBeUndefined();
  });

  it('sends nothing when, back online, it should not go on (the account changed meanwhile)', async () => {
    const { storage, data } = memStorage({ [KEY]: raw });
    expect(await mergeOnLogin('u1', { storage, whenOnline: async () => false })).toBe('kept');
    expect(sent).toBe(0);
    expect(data[KEY]).toBe(raw);
  });

  it('does not wait when there is nothing to merge', async () => {
    const wait = vi.fn(() => new Promise<boolean>(() => {}));
    expect(await mergeOnLogin('u1', { storage: memStorage().storage, whenOnline: wait })).toBe('empty');
    expect(wait).not.toHaveBeenCalled();
  });
});

describe('whenOnline', () => {
  it('resolves at once while the browser is online', async () => {
    await expect(whenOnline()).resolves.toBeUndefined();
  });

  it('waits for the `online` event while the browser says it is offline', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    let done = false;
    const waiting = whenOnline().then(() => (done = true));
    await tick();
    expect(done).toBe(false);
    window.dispatchEvent(new Event('online'));
    await waiting;
    expect(done).toBe(true);
  });
});
