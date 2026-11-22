import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { freshStore } from '@/features/library/test-library-server';
import { EMPTY_LIBRARY } from '@/features/library/types';
import type { OfflineStore } from '@/features/offline/store-types';
import {
  clearSignOutPending,
  forgetIdentity,
  identityKey,
  LAST_IDENTITY,
  markSignOutPending,
  offlineIdentity,
  readSignOutPending,
  rememberIdentity,
  SIGN_OUT_PENDING,
  wipeDeviceAccount,
} from './offline-identity';
import { sessionUser } from './test-auth';

let store: OfflineStore;
beforeEach(async () => {
  store = await freshStore();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('offline identity', () => {
  it('is null on a device that never kept one', async () => {
    expect(await offlineIdentity(store)).toBeNull();
  });

  it('gives back the last remembered user, whole', async () => {
    const ana = sessionUser('ana', { name: 'Ana', emailVerified: true, provider: 'google' });
    await rememberIdentity(store, ana);
    expect(await offlineIdentity(store)).toEqual(ana);
    expect(await store.getMeta(identityKey('ana'))).toEqual(ana);
    // `last-identity` holds just the uid: the person's details live under `identity:<uid>` only.
    expect(await store.getMeta(LAST_IDENTITY)).toBe('ana');
  });

  it('follows whoever signed in last', async () => {
    await rememberIdentity(store, sessionUser('ana'));
    await rememberIdentity(store, sessionUser('bia'));
    expect((await offlineIdentity(store))?.id).toBe('bia');
  });

  it('is null when last-identity points at an identity that is gone (wiped with the account)', async () => {
    await rememberIdentity(store, sessionUser('ana'));
    await store.wipeAccount('ana');
    expect(await store.getMeta(LAST_IDENTITY)).toBe('ana');
    expect(await offlineIdentity(store)).toBeNull();
  });

  it('is null for a stored identity that is not a valid user, or that names someone else', async () => {
    await store.setMeta(LAST_IDENTITY, 'ana');
    await store.setMeta(identityKey('ana'), { id: 'ana', email: 3 });
    expect(await offlineIdentity(store)).toBeNull();
    await store.setMeta(identityKey('ana'), sessionUser('bia'));
    expect(await offlineIdentity(store)).toBeNull();
  });

  it('forgetIdentity drops the identity and the pointer, and leaves the queue', async () => {
    await rememberIdentity(store, sessionUser('ana'));
    await store.enqueue({
      id: '00000000-0000-4000-8000-000000000001',
      uid: 'ana',
      command: { type: 'remove', ref: { mediaType: 'movie', tmdbId: 1 } },
      at: new Date().toISOString(),
      attempts: 0,
    });
    await forgetIdentity(store, 'ana');
    expect(await offlineIdentity(store)).toBeNull();
    expect(await store.getMeta(LAST_IDENTITY)).toBeUndefined();
    expect(await store.countQueue('ana')).toBe(1);
  });

  it('forgetIdentity keeps the pointer when it names someone else', async () => {
    await rememberIdentity(store, sessionUser('ana'));
    await rememberIdentity(store, sessionUser('bia'));
    await forgetIdentity(store, 'ana');
    expect((await offlineIdentity(store))?.id).toBe('bia');
  });

  it('wipeDeviceAccount removes everything of that account, last-identity included, and nobody else', async () => {
    await rememberIdentity(store, sessionUser('bia'));
    await rememberIdentity(store, sessionUser('ana'));
    await store.putSnapshot('ana', EMPTY_LIBRARY);
    await store.putSnapshot('bia', EMPTY_LIBRARY);
    await wipeDeviceAccount(store, 'ana');
    expect(await store.getSnapshot('ana')).toBeNull();
    expect(await store.getMeta(LAST_IDENTITY)).toBeUndefined();
    expect(await store.getMeta(identityKey('bia'))).toEqual(sessionUser('bia'));
    expect(await store.getSnapshot('bia')).not.toBeNull();
  });
});

describe('pending sign-out mark', () => {
  it('is written, read and cleared under sign-out-pending', async () => {
    expect(await readSignOutPending(store)).toBeNull();
    await markSignOutPending(store, 'ana');
    expect(await store.getMeta(SIGN_OUT_PENDING)).toEqual({ uid: 'ana' });
    expect(await readSignOutPending(store)).toEqual({ uid: 'ana' });
    await clearSignOutPending(store);
    expect(await readSignOutPending(store)).toBeNull();
  });

  it('survives wiping the account it names', async () => {
    await markSignOutPending(store, 'ana');
    await wipeDeviceAccount(store, 'ana');
    expect(await readSignOutPending(store)).toEqual({ uid: 'ana' });
  });

  it('reads a malformed mark as a pending sign-out of nobody in particular', async () => {
    await store.setMeta(SIGN_OUT_PENDING, 'yes');
    expect(await readSignOutPending(store)).toEqual({ uid: null });
  });
});
