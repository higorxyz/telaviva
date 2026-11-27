import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hangRequests } from '@/features/library/test-library-server';
import { REQUEST_TIMEOUT_MS } from '@/lib/request-timeout';
import { server } from '@/test/server';
import { createSession, deleteSession, fetchMe, SessionRequestError } from './session-client';

const url = (path: string) => `${window.location.origin}${path}`;

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** Only the timers: fake IndexedDB and MSW keep their own scheduling. */
const fakeTimers = () => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

describe('fetchMe', () => {
  it('a request that never answers (signal but no data) counts as an error after the timeout', async () => {
    fakeTimers();
    hangRequests();
    let result: unknown;
    void fetchMe().then((me) => (result = me));
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS - 1);
    expect(result).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(result).toEqual({ kind: 'error', reason: 'timeout' });
  });

  it('a network failure is an error that is not a timeout', async () => {
    server.use(http.get(url('/api/auth/me'), () => HttpResponse.error()));
    expect(await fetchMe()).toEqual({ kind: 'error' });
  });

  it('an answer in time clears the timer', async () => {
    fakeTimers();
    server.use(http.get(url('/api/auth/me'), () => HttpResponse.json({ error: 'unauthenticated' }, { status: 401 })));
    expect(await fetchMe()).toEqual({ kind: 'unauthenticated' });
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('deleteSession', () => {
  it('a DELETE that never answers resolves false after the timeout (the sign-out stays pending)', async () => {
    fakeTimers();
    hangRequests();
    let result: boolean | undefined;
    void deleteSession().then((done) => (result = done));
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
    expect(result).toBe(false);
  });
});

describe('createSession', () => {
  it('a POST that never answers fails like a network error (status null) after the timeout', async () => {
    fakeTimers();
    hangRequests();
    let error: unknown;
    void createSession('token').catch((e) => (error = e));
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS - 1);
    expect(error).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(error).toBeInstanceOf(SessionRequestError);
    expect((error as SessionRequestError).status).toBeNull();
  });
});
