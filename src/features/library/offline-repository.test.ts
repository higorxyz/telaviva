import 'fake-indexeddb/auto';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearLeaving, markLeaving } from '../offline/leaving';
import type { OfflineStore } from '../offline/store-types';
import { server as msw } from '@/test/server';
import { applyCommand, type LibraryCommand } from './commands';
import { createOfflineAccountRepository } from './offline-repository';
import {
  LibraryRemoteError,
  LibrarySessionError,
  LibraryWrongAccountError,
  type LibraryRepository,
} from './repository';
import { createServerRepository } from './server-repository';
import {
  fakeLibraryServer,
  freshStore,
  hangRequests,
  postFromAnotherTab,
  queuedCommand,
  reportOnline,
  UID,
} from './test-library-server';
import { REQUEST_TIMEOUT_MS } from '@/lib/request-timeout';
import { want } from './test-storage';
import { EMPTY_LIBRARY, type LibraryState } from './types';

const T0 = '2026-11-21T08:00:00.000Z';
const T1 = '2026-11-21T09:00:00.000Z';
const T2 = '2026-11-21T09:05:00.000Z';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const movie = (tmdbId: number) => ({ mediaType: 'movie' as const, tmdbId });
const remove = (tmdbId: number): LibraryCommand => ({ type: 'remove', ref: movie(tmdbId) });
const ids = (state: LibraryState) => state.items.map((i) => i.tmdbId);

let store: OfflineStore;
let stops: (() => void)[] = [];
let clock = T1;

beforeEach(async () => {
  store = await freshStore();
  clock = T1;
});
afterEach(() => {
  stops.forEach((stop) => stop());
  stops = [];
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function setup(opts: { renews?: boolean } = {}) {
  const onUnauthenticated = vi.fn(async () => opts.renews ?? false);
  const onWrongAccount = vi.fn();
  const server = createServerRepository({ uid: UID, onUnauthenticated, onWrongAccount });
  const repository = createOfflineAccountRepository({ server, store, uid: UID, now: () => clock });
  return { repository, queue: repository.queue!, onUnauthenticated };
}

/** The account was loaded online once, which saved its copy on the device. */
async function loadedOnline(repository: LibraryRepository) {
  return repository.load();
}

describe('createOfflineAccountRepository', () => {
  it('is persistent, remote and carries the account error copy', () => {
    const { repository } = setup();
    expect(repository).toMatchObject({ persistent: true, remote: true });
    expect(repository.errorMessage).toBe('Não foi possível salvar na sua conta. Tente de novo.');
  });

  it('online with an empty queue: sends right away with a command id (no `at`) and saves the answer', async () => {
    const fake = fakeLibraryServer();
    const { repository } = setup();
    const applied = await repository.applyWithPreImage!(want(1));
    expect(fake.received).toEqual([{ command: want(1), commandId: expect.stringMatching(UUID) }]);
    expect(applied).toEqual({ state: fake.stored, previous: { item: null, rating: null, marks: [] } });
    expect((await store.getSnapshot(UID))?.state).toEqual(fake.stored);
    expect(await store.countQueue(UID)).toBe(0);
  });

  it('offline: the action is in the answered list at once and waits in the queue, with its time and id', async () => {
    const fake = fakeLibraryServer(applyCommand(EMPTY_LIBRARY, want(1), T0));
    const { repository } = setup();
    await loadedOnline(repository);
    fake.offline = true;
    clock = T2;
    const applied = await repository.applyWithPreImage!(want(2));
    expect(ids(applied.state)).toEqual([1, 2]);
    expect(applied.previous).toBeNull();
    expect(applied.queued).toEqual({ id: expect.stringMatching(UUID), previous: { item: null, rating: null, marks: [] } });
    const queue = await store.listQueue(UID);
    expect(queue).toEqual([{ id: applied.queued!.id, uid: UID, command: want(2), at: T2, attempts: 0 }]);
  });

  it('while the browser reports being offline, queues without trying the network', async () => {
    const fake = fakeLibraryServer();
    const { repository } = setup();
    await loadedOnline(repository);
    reportOnline(false);
    await repository.applyWithPreImage!(want(1));
    expect(fake.received).toEqual([]);
    expect(await store.countQueue(UID)).toBe(1);
  });

  it('reloading offline answers the saved copy with the queue on top', async () => {
    const fake = fakeLibraryServer(applyCommand(EMPTY_LIBRARY, want(1), T0));
    await loadedOnline(setup().repository);
    fake.offline = true;
    await setup().repository.applyWithPreImage!(remove(1));
    await setup().repository.applyWithPreImage!(want(2));
    const reloaded = await setup().repository.load();
    expect(ids(reloaded)).toEqual([2]);
    expect(reloaded.items[0]).toMatchObject({ addedAt: T1 });
  });

  it('a load the server answers saves its copy and keeps the actions not sent yet on top', async () => {
    const fake = fakeLibraryServer(applyCommand(EMPTY_LIBRARY, want(1), T0));
    await store.enqueue(queuedCommand(want(2), T1));
    const loaded = await setup().repository.load();
    expect(ids(loaded)).toEqual([1, 2]);
    expect((await store.getSnapshot(UID))?.state).toEqual(fake.stored);
  });

  it('a load with neither the server nor a saved copy fails with the network error', async () => {
    const fake = fakeLibraryServer();
    fake.offline = true;
    await expect(setup().repository.load()).rejects.toMatchObject({ network: true });
  });

  it('a load passes a lost session, a wrong account and an answered error straight through', async () => {
    const fake = fakeLibraryServer();
    await loadedOnline(setup().repository);
    const { http, HttpResponse } = await import('msw');
    const { server } = await import('@/test/server');
    const answer = (status: number, error: string) =>
      server.use(http.get(`${window.location.origin}/api/library`, () => HttpResponse.json({ error }, { status })));
    answer(401, 'unauthenticated');
    await expect(setup().repository.load()).rejects.toBeInstanceOf(LibrarySessionError);
    answer(409, 'wrong_account');
    await expect(setup().repository.load()).rejects.toBeInstanceOf(LibraryWrongAccountError);
    answer(500, 'internal');
    await expect(setup().repository.load()).rejects.toMatchObject({ network: false, status: 500 });
    expect(fake.loads).toBe(1);
  });

  it('with actions waiting, a new action online goes to the queue too, and the queue goes out in order', async () => {
    const fake = fakeLibraryServer();
    const { repository, queue } = setup();
    await loadedOnline(repository);
    const waiting = queuedCommand(want(1), T0);
    await store.enqueue(waiting);
    // Sending only from the next kick on: the queue is not empty when the action comes.
    reportOnline(false);
    stops.push(queue.start());
    vi.restoreAllMocks();
    const applied = await repository.applyWithPreImage!(want(2));
    expect(applied.queued).toBeDefined();
    expect(ids(applied.state)).toEqual([1, 2]);
    await vi.waitFor(async () => expect(await store.countQueue(UID)).toBe(0));
    expect(fake.received.map((r) => [r.command, r.commandId])).toEqual([
      [want(1), waiting.id],
      [want(2), applied.queued!.id],
    ]);
  });

  it('an answered error (5xx) is not queued: it fails as before', async () => {
    const fake = fakeLibraryServer();
    const { repository } = setup();
    await loadedOnline(repository);
    fake.answerNext(500);
    await expect(repository.applyWithPreImage!(want(1))).rejects.toMatchObject({ network: false, status: 500 });
    expect(await store.countQueue(UID)).toBe(0);
  });

  it('a network failure with no saved copy is not queued: there is nothing to apply it to', async () => {
    const fake = fakeLibraryServer();
    fake.offline = true;
    await expect(setup().repository.applyWithPreImage!(want(1))).rejects.toBeInstanceOf(LibraryRemoteError);
    expect(await store.countQueue(UID)).toBe(0);
  });

  it('a restore (undo) is never queued', async () => {
    const fake = fakeLibraryServer();
    const { repository } = setup();
    await loadedOnline(repository);
    fake.offline = true;
    const restore: LibraryCommand = { type: 'restore', ref: movie(1), item: null, rating: null, marks: [] };
    await expect(repository.applyWithPreImage!(restore)).rejects.toMatchObject({ network: true });
    expect(await store.countQueue(UID)).toBe(0);
  });

  it('unqueue takes an action out before it is sent and answers the list without it, sending nothing', async () => {
    const fake = fakeLibraryServer(applyCommand(EMPTY_LIBRARY, want(1), T0));
    const { repository, queue } = setup();
    await loadedOnline(repository);
    fake.offline = true;
    const first = await repository.applyWithPreImage!(want(2));
    await repository.applyWithPreImage!(want(3));
    const state = await queue.unqueue(first.queued!.id);
    expect(ids(state!)).toEqual([1, 3]);
    expect((await store.listQueue(UID)).map((i) => i.command)).toEqual([want(3)]);
    expect(fake.received).toEqual([]);
  });

  it('unqueue of an action already sent answers null', async () => {
    fakeLibraryServer();
    const { queue } = setup();
    expect(await queue.unqueue('00000000-0000-4000-8000-00000000ffff')).toBeNull();
  });

  it('counts the queue, and tells its listeners when this tab or another one changes it', async () => {
    const fake = fakeLibraryServer();
    const { repository, queue } = setup();
    await loadedOnline(repository);
    const heard = vi.fn();
    stops.push(queue.subscribe(heard));
    fake.offline = true;
    await repository.applyWithPreImage!(want(1));
    expect(await queue.count()).toBe(1);
    expect(heard).toHaveBeenCalledTimes(1);
    postFromAnotherTab({ uid: UID, kind: 'queue' });
    postFromAnotherTab({ uid: 'someone-else', kind: 'queue' });
    await vi.waitFor(() => expect(heard).toHaveBeenCalledTimes(2));
  });

  it('subscribers reload when another tab synced or queued for this account only', async () => {
    fakeLibraryServer();
    const onChange = vi.fn();
    stops.push(setup().repository.subscribe(onChange));
    postFromAnotherTab({ uid: 'someone-else', kind: 'synced' });
    postFromAnotherTab({ uid: UID, kind: 'synced' });
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
  });

  it('degrades to the plain server behaviour when the store fails', async () => {
    const fake = fakeLibraryServer(applyCommand(EMPTY_LIBRARY, want(1), T0));
    const broken = new Error('connection lost');
    for (const method of ['getSnapshot', 'putSnapshot', 'listQueue', 'countQueue'] as const) {
      vi.spyOn(store, method).mockRejectedValue(broken);
    }
    const { repository, queue } = setup();
    expect(ids(await repository.load())).toEqual([1]);
    expect(ids((await repository.applyWithPreImage!(want(2))).state)).toEqual([1, 2]);
    expect(await queue.count()).toBe(0);
    fake.offline = true;
    await expect(repository.applyWithPreImage!(want(3))).rejects.toMatchObject({ network: true });
  });
});

describe('createOfflineAccountRepository: signal but no data (navigator.onLine stays true)', () => {
  /** Only the 8 s are skipped: the store's own scheduling keeps running. */
  const fakeTimers = () => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'], shouldAdvanceTime: true });
  const timeOut = () => vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);

  it('a load that never answers falls back to the saved copy (with the queue on top) after the timeout', async () => {
    const fake = fakeLibraryServer(applyCommand(EMPTY_LIBRARY, want(1), T0));
    const { repository } = setup();
    await loadedOnline(repository);
    fake.offline = true;
    await repository.applyWithPreImage!(want(2));
    fakeTimers();
    const fetch = hangRequests();
    let loaded: LibraryState | undefined;
    void repository.load().then((state) => (loaded = state));
    await vi.waitUntil(() => fetch.mock.calls.length === 1);
    expect(loaded).toBeUndefined();
    await timeOut();
    await vi.waitUntil(() => loaded !== undefined);
    expect(ids(loaded!)).toEqual([1, 2]);
  });

  it('an action whose POST never answers is queued after the timeout, with the id it was sent with', async () => {
    fakeLibraryServer(applyCommand(EMPTY_LIBRARY, want(1), T0));
    const { repository } = setup();
    await loadedOnline(repository);
    fakeTimers();
    const fetch = hangRequests();
    let applied: Awaited<ReturnType<NonNullable<typeof repository.applyWithPreImage>>> | undefined;
    void repository.applyWithPreImage!(want(2)).then((result) => (applied = result));
    await vi.waitUntil(() => fetch.mock.calls.length === 1);
    const sent = JSON.parse(String(fetch.mock.calls[0]![1]!.body)) as { commandId: string };
    await timeOut();
    await vi.waitUntil(() => applied !== undefined);
    expect(ids(applied!.state)).toEqual([1, 2]);
    expect(applied!.queued?.id).toBe(sent.commandId);
    // If the POST did reach the server, the resend carries the same id and the server applies it once.
    expect((await store.listQueue(UID)).map((item) => item.id)).toEqual([sent.commandId]);
  });

  it('a send that never answers lets go of the queue lock after the timeout, so an undo goes through', async () => {
    const fake = fakeLibraryServer(applyCommand(EMPTY_LIBRARY, want(1), T0));
    const { repository, queue } = setup();
    await loadedOnline(repository);
    fake.offline = true;
    const action = await repository.applyWithPreImage!(want(2));
    fakeTimers();
    const fetch = hangRequests();
    stops.push(queue.start());
    await vi.waitUntil(() => fetch.mock.calls.length === 1);
    let undone: LibraryState | null | undefined;
    void queue.unqueue(action.queued!.id).then((state) => (undone = state));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(undone).toBeUndefined();
    await timeOut();
    await vi.waitUntil(() => undone !== undefined);
    expect(ids(undone!)).toEqual([1]);
    expect(await store.countQueue(UID)).toBe(0);
  });
});

describe('createOfflineAccountRepository: an answer landing after "Sair" wiped the account', () => {
  const url = (path: string) => `${window.location.origin}${path}`;
  afterEach(() => clearLeaving(UID));

  /** Holds the next answer to `method path` until `release()` (or makes it fail as a network error: `fail()`). */
  function holdNext(method: 'get' | 'post', path: string, answer: () => Response) {
    let release!: () => void;
    let fail!: () => void;
    const gate = new Promise<boolean>((resolve) => {
      release = () => resolve(true);
      fail = () => resolve(false);
    });
    let arrived = false;
    msw.use(
      http[method](
        url(path),
        async () => {
          arrived = true;
          return (await gate) ? answer() : HttpResponse.error();
        },
        { once: true },
      ),
    );
    return { release, fail, arrived: () => arrived };
  }

  /** What "Sair" does to the device (auth-flows.ts `leave`): the mark first, then the wipe. */
  async function signOut() {
    markLeaving(UID);
    await store.wipeAccount(UID);
  }

  it('a load in flight writes no copy back', async () => {
    const fake = fakeLibraryServer(applyCommand(EMPTY_LIBRARY, want(1), T0));
    const { repository } = setup();
    await loadedOnline(repository);
    const held = holdNext('get', '/api/library', () => HttpResponse.json(fake.stored));
    const loading = repository.load();
    await vi.waitUntil(held.arrived);
    await signOut();
    held.release();
    await loading;
    expect(await store.getSnapshot(UID)).toBeNull();
  });

  it('a send in flight writes no copy back', async () => {
    const fake = fakeLibraryServer(applyCommand(EMPTY_LIBRARY, want(1), T0));
    const { repository } = setup();
    await loadedOnline(repository);
    const held = holdNext('post', '/api/library/commands', () =>
      HttpResponse.json({ library: applyCommand(fake.stored, want(2), T1), previous: null }),
    );
    const sending = repository.applyWithPreImage!(want(2));
    await vi.waitUntil(held.arrived);
    await signOut();
    held.release();
    await sending;
    expect(await store.getSnapshot(UID)).toBeNull();
  });

  it('a send in flight that then fails is not queued (it fails, nothing is kept)', async () => {
    fakeLibraryServer(applyCommand(EMPTY_LIBRARY, want(1), T0));
    const { repository } = setup();
    await loadedOnline(repository);
    const held = holdNext('post', '/api/library/commands', () => HttpResponse.error());
    const sending = repository.applyWithPreImage!(want(2)).catch((error: unknown) => error);
    await vi.waitUntil(held.arrived);
    markLeaving(UID);
    held.fail();
    expect(await sending).toMatchObject({ network: true });
    expect(await store.countQueue(UID)).toBe(0);
  });

  it('after signing in again, the copy is kept as usual', async () => {
    const fake = fakeLibraryServer(applyCommand(EMPTY_LIBRARY, want(1), T0));
    const { repository } = setup();
    await signOut();
    clearLeaving(UID);
    await repository.load();
    expect((await store.getSnapshot(UID))?.state).toEqual(fake.stored);
  });
});
