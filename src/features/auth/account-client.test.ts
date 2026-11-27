import { afterEach, describe, expect, it, vi } from 'vitest';
import { hangRequests } from '@/features/library/test-library-server';
import { REQUEST_TIMEOUT_MS } from '@/lib/request-timeout';
import {
  clearLocalAccountData,
  downloadAccountExport,
  EXPORT_TIMEOUT_MS,
  requestAccountDeletion,
} from './account-client';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('clearLocalAccountData', () => {
  it("removes the visitor's library even when the uid is no longer known", () => {
    window.localStorage.setItem('telaviva:library:v1', '{}');
    window.localStorage.setItem('telaviva:library:v1:pre-merge:u1', '{}');
    clearLocalAccountData(null);
    expect(window.localStorage.getItem('telaviva:library:v1')).toBeNull();
    expect(window.localStorage.getItem('telaviva:library:v1:pre-merge:u1')).toBe('{}');
  });
});

const fakeTimers = () => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

describe('requestAccountDeletion', () => {
  it('a DELETE that never answers is an error (safe to try again), not offline, after the timeout', async () => {
    fakeTimers();
    hangRequests();
    let result: unknown;
    void requestAccountDeletion('u1').then((r) => (result = r));
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
    expect(result).toBe('error');
  });
});

describe('downloadAccountExport', () => {
  it('an export that never answers rejects after its own, longer timeout', async () => {
    fakeTimers();
    hangRequests();
    let error: unknown;
    void downloadAccountExport('u1').catch((e) => (error = e));
    await vi.advanceTimersByTimeAsync(EXPORT_TIMEOUT_MS - 1);
    expect(error).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(error).toBeInstanceOf(DOMException);
  });
});
