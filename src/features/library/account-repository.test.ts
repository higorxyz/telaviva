import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAccountRepository } from './account-repository';
import { applyCommand } from './commands';
import { createServerRepository } from './server-repository';
import { fakeLibraryServer, freshStore, UID } from './test-library-server';
import { want } from './test-storage';
import { EMPTY_LIBRARY } from './types';

const T0 = '2026-11-21T08:00:00.000Z';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const server = () => createServerRepository({ uid: UID, onUnauthenticated: async () => false });

describe('createAccountRepository', () => {
  it('without the on-device store, is the plain server library: nothing is saved or queued', async () => {
    const fake = fakeLibraryServer(applyCommand(EMPTY_LIBRARY, want(1), T0));
    const repository = createAccountRepository({ server: server(), uid: UID, openStore: async () => null });
    expect(await repository.load()).toEqual(fake.stored);
    fake.offline = true;
    await expect(repository.load()).rejects.toMatchObject({ network: true });
    await expect(repository.applyWithPreImage!(want(2))).rejects.toMatchObject({ network: true });
    expect(await repository.queue!.count()).toBe(0);
    expect(await repository.queue!.unqueue('any')).toBeNull();
    repository.queue!.start()();
  });

  it('when the store fails to open, is the plain server library too', async () => {
    const fake = fakeLibraryServer();
    const repository = createAccountRepository({ server: server(), uid: UID, openStore: () => Promise.reject(new Error('blocked')) });
    expect(await repository.load()).toEqual(fake.stored);
  });

  it('with the store, works offline: the saved copy loads and actions queue', async () => {
    const store = await freshStore();
    const fake = fakeLibraryServer(applyCommand(EMPTY_LIBRARY, want(1), T0));
    const repository = createAccountRepository({ server: server(), uid: UID, openStore: async () => store });
    await repository.load();
    fake.offline = true;
    const applied = await repository.applyWithPreImage!(want(2));
    expect(applied.queued).toBeDefined();
    expect(await repository.queue!.count()).toBe(1);
    expect((await repository.load()).items.map((i) => i.tmdbId)).toEqual([1, 2]);
  });

  it('a subscription stopped before the store opened never attaches', async () => {
    fakeLibraryServer();
    let open: (value: null) => void = () => {};
    const target = server();
    const subscribe = vi.spyOn(target, 'subscribe');
    const repository = createAccountRepository({
      server: target,
      uid: UID,
      openStore: () => new Promise((resolve) => (open = resolve)),
    });
    repository.subscribe(() => {})();
    open(null);
    await repository.load();
    expect(subscribe).not.toHaveBeenCalled();
  });
});
