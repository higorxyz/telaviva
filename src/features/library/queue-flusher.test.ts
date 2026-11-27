import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearLeaving, markLeaving } from '../offline/leaving';
import type { OfflineStore } from '../offline/store-types';
import { applyCommand } from './commands';
import { createQueueFlusher, type FlushOutcome } from './queue-flusher';
import { withQueueLock, type LibraryMessage } from './queue-sync';
import { createServerRepository } from './server-repository';
import {
  anotherConnection,
  fakeLibraryServer,
  freshStore,
  hangRequests,
  installFakeLocks,
  listenAsAnotherTab,
  queuedCommand,
  reportOnline,
  UID,
} from './test-library-server';
import { want } from './test-storage';
import { REQUEST_TIMEOUT_MS } from '@/lib/request-timeout';
import { EMPTY_LIBRARY } from './types';

const T1 = '2026-11-21T09:00:00.000Z';
const T2 = '2026-11-21T09:05:00.000Z';
const T3 = '2026-11-21T09:10:00.000Z';
const NOW = '2026-11-21T12:00:00.000Z';
const DAY = 86_400_000;

let store: OfflineStore;
let stops: (() => void)[] = [];

beforeEach(async () => {
  store = await freshStore();
  retries = [];
});
afterEach(() => {
  stops.forEach((stop) => stop());
  stops = [];
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** The retries each flusher scheduled, by their delay (never run: the tests flush by hand). */
let retries: number[] = [];
const later = (_retry: () => void, delay: number) => {
  retries.push(delay);
  return () => {};
};

function setup(opts: { renews?: boolean; on?: OfflineStore } = {}) {
  const onUnauthenticated = vi.fn(async () => opts.renews ?? false);
  const onWrongAccount = vi.fn();
  const server = createServerRepository({ uid: UID, onUnauthenticated, onWrongAccount });
  const settled: FlushOutcome[] = [];
  const onRetry = vi.fn();
  const flusher = createQueueFlusher({
    store: opts.on ?? store,
    server,
    uid: UID,
    now: () => NOW,
    later,
    onSettled: (outcome) => settled.push(outcome),
    onRetry,
  });
  stops.push(() => flusher.stop());
  return { flusher, settled, onUnauthenticated, onWrongAccount, onRetry };
}

async function enqueue(...items: ReturnType<typeof queuedCommand>[]) {
  for (const item of items) await store.enqueue(item);
  return items;
}

describe('createQueueFlusher', () => {
  it('sends the queue in order with each action’s own time and id, empties it and saves the last answer', async () => {
    const fake = fakeLibraryServer();
    const [a, b, c] = await enqueue(queuedCommand(want(1), T1), queuedCommand(want(2), T2), queuedCommand(want(3), T3));
    const heard: LibraryMessage[] = [];
    stops.push(listenAsAnotherTab((m) => heard.push(m)));
    const { flusher, settled } = setup();
    await flusher.flush();
    expect(fake.received).toEqual([
      { command: want(1), at: T1, commandId: a!.id },
      { command: want(2), at: T2, commandId: b!.id },
      { command: want(3), at: T3, commandId: c!.id },
    ]);
    expect(await store.listQueue(UID)).toEqual([]);
    expect((await store.getSnapshot(UID))?.state).toEqual(fake.stored);
    expect(fake.stored.items.map((i) => i.updatedAt)).toEqual([T1, T2, T3]);
    expect(settled).toEqual([{ sent: 3, rejected: 0, expired: 0 }]);
    await vi.waitFor(() => expect(heard).toEqual([{ uid: UID, kind: 'synced' }]));
  });

  it('two tabs coming back at once send each action exactly once (Web Locks)', async () => {
    stops.push(installFakeLocks());
    const fake = fakeLibraryServer();
    const items = await enqueue(queuedCommand(want(1), T1), queuedCommand(want(2), T2), queuedCommand(want(3), T3));
    const tabA = setup();
    const tabB = setup({ on: await anotherConnection() });
    await Promise.all([tabA.flusher.flush(), tabB.flusher.flush(), tabA.flusher.flush(), tabB.flusher.flush()]);
    expect(fake.received.map((r) => r.commandId)).toEqual(items.map((i) => i.id));
    expect(await store.listQueue(UID)).toEqual([]);
  });

  it('without navigator.locks, runs directly', async () => {
    expect('locks' in navigator).toBe(false);
    const fake = fakeLibraryServer();
    await enqueue(queuedCommand(want(1), T1));
    await setup().flusher.flush();
    expect(fake.received).toHaveLength(1);
  });

  it('a 401 that renews the session goes on sending', async () => {
    const fake = fakeLibraryServer();
    await enqueue(queuedCommand(want(1), T1), queuedCommand(want(2), T2));
    fake.answerNext(401, 'unauthenticated');
    const { flusher, onUnauthenticated } = setup({ renews: true });
    await flusher.flush();
    expect(onUnauthenticated).toHaveBeenCalledTimes(1);
    expect(fake.stored.items).toHaveLength(2);
    expect(await store.listQueue(UID)).toEqual([]);
  });

  it('a 401 that does not renew stops and keeps the whole queue, with no retry scheduled', async () => {
    const fake = fakeLibraryServer();
    const items = await enqueue(queuedCommand(want(1), T1), queuedCommand(want(2), T2));
    fake.answerNext(401, 'unauthenticated');
    const { flusher, settled } = setup({ renews: false });
    await flusher.flush();
    expect(fake.received).toHaveLength(1);
    expect((await store.listQueue(UID)).map((i) => i.id)).toEqual(items.map((i) => i.id));
    expect(retries).toEqual([]);
    expect(settled).toEqual([]);
  });

  it('a 400 stale drops that action, reports it and goes on with the next', async () => {
    const fake = fakeLibraryServer();
    await enqueue(queuedCommand(want(1), T1), queuedCommand(want(2), T2));
    fake.answerNext(400, 'stale');
    const { flusher, settled } = setup();
    await flusher.flush();
    expect(await store.listQueue(UID)).toEqual([]);
    expect(fake.stored.items.map((i) => i.tmdbId)).toEqual([2]);
    expect(settled).toEqual([{ sent: 1, rejected: 1, expired: 0 }]);
  });

  it('a 403 stops and keeps the whole queue, with no retry scheduled and nothing reported', async () => {
    const fake = fakeLibraryServer();
    const items = await enqueue(queuedCommand(want(1), T1), queuedCommand(want(2), T2));
    fake.answerNext(403, 'forbidden');
    const { flusher, settled } = setup();
    await flusher.flush();
    expect(fake.received).toHaveLength(1);
    expect((await store.listQueue(UID)).map((i) => i.id)).toEqual(items.map((i) => i.id));
    expect(retries).toEqual([]);
    expect(settled).toEqual([]);
  });

  it('a 404, 405, 415, 408 or 429 keeps the queue and retries later (only a 400 is about the action)', async () => {
    const fake = fakeLibraryServer();
    const items = await enqueue(queuedCommand(want(1), T1), queuedCommand(want(2), T2));
    const { flusher, settled } = setup();
    for (const status of [404, 405, 415, 408, 429]) {
      fake.answerNext(status);
      await flusher.flush();
    }
    expect(fake.received).toHaveLength(5);
    expect(await store.listQueue(UID)).toEqual([
      { ...items[0], attempts: 5 },
      items[1],
    ]);
    expect(retries).toEqual([2000, 4000, 8000, 16000, 32000]);
    expect(settled).toEqual([]);
  });

  it('a 400 with any code (validation) drops that action too', async () => {
    const fake = fakeLibraryServer();
    await enqueue(queuedCommand(want(1), T1));
    fake.answerNext(400, 'invalid');
    const { flusher, settled } = setup();
    await flusher.flush();
    expect(await store.countQueue(UID)).toBe(0);
    expect(settled).toEqual([{ sent: 0, rejected: 1, expired: 0 }]);
  });

  it('a run that only drops actions still tells the other tabs: their count reaches 0', async () => {
    const fake = fakeLibraryServer();
    await enqueue(queuedCommand(want(1), T1), queuedCommand(want(2), T2));
    // Tab B loads its own copy of the modules, as another tab would (its own tab id on the library channel).
    vi.resetModules();
    const inTabB = await import('./offline-repository');
    const serverInTabB = await import('./server-repository');
    const server = serverInTabB.createServerRepository({ uid: UID, onUnauthenticated: async () => false });
    const tabB = inTabB.createOfflineAccountRepository({ server, store: await anotherConnection(), uid: UID });
    let countB = await tabB.queue.count();
    expect(countB).toBe(2);
    stops.push(tabB.queue.subscribe(() => void tabB.queue.count().then((n) => (countB = n))));
    const reloadB = vi.fn();
    stops.push(tabB.subscribe(reloadB));
    fake.answerNext(400, 'stale');
    fake.answerNext(413, 'limit');
    await setup().flusher.flush();
    expect(fake.received).toHaveLength(2);
    await vi.waitFor(() => expect(countB).toBe(0));
    await vi.waitFor(() => expect(reloadB).toHaveBeenCalled());
  });

  it('a 409 conflict (only a restore can get it, and none is queued) is dropped without a report', async () => {
    const fake = fakeLibraryServer();
    await enqueue(queuedCommand(want(1), T1));
    fake.answerNext(409, 'conflict');
    const { flusher, settled } = setup();
    await flusher.flush();
    expect(await store.listQueue(UID)).toEqual([]);
    expect(settled).toEqual([{ sent: 0, rejected: 0, expired: 0 }]);
  });

  it('409 wrong_account stops without sending anything else and keeps the queue', async () => {
    const fake = fakeLibraryServer();
    const items = await enqueue(queuedCommand(want(1), T1), queuedCommand(want(2), T2));
    fake.answerNext(409, 'wrong_account');
    const { flusher, onWrongAccount } = setup();
    await flusher.flush();
    expect(fake.received).toHaveLength(1);
    expect(fake.stored).toEqual(EMPTY_LIBRARY);
    expect(onWrongAccount).toHaveBeenCalledTimes(1);
    expect((await store.listQueue(UID)).map((i) => i.id)).toEqual(items.map((i) => i.id));
    expect(retries).toEqual([]);
  });

  it('a 5xx or a network failure stops, counts the attempt and retries later: 2 s, 4 s… reset by a success', async () => {
    const fake = fakeLibraryServer();
    const [a] = await enqueue(queuedCommand(want(1), T1), queuedCommand(want(2), T2));
    const { flusher } = setup();
    fake.answerNext(503);
    await flusher.flush();
    expect(fake.received).toHaveLength(1);
    expect((await store.listQueue(UID))[0]).toMatchObject({ id: a!.id, attempts: 1 });
    fake.offline = true;
    await flusher.flush();
    expect((await store.listQueue(UID))[0]).toMatchObject({ id: a!.id, attempts: 2 });
    expect(retries).toEqual([2000, 4000]);
    fake.offline = false;
    await flusher.flush();
    expect(await store.listQueue(UID)).toEqual([]);
    await enqueue(queuedCommand(want(3), T3));
    fake.answerNext(500);
    await flusher.flush();
    expect(retries).toEqual([2000, 4000, 2000]);
  });

  it('a send that never answers (signal but no data) ends the run after the timeout: lock released, retry later', async () => {
    stops.push(installFakeLocks());
    const [a] = await enqueue(queuedCommand(want(1), T1));
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'], shouldAdvanceTime: true });
    const fetch = hangRequests();
    const { flusher } = setup();
    let done = false;
    void flusher.flush().then(() => (done = true));
    await vi.waitUntil(() => fetch.mock.calls.length === 1);
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
    await vi.waitUntil(() => done);
    expect((await store.listQueue(UID))[0]).toMatchObject({ id: a!.id, attempts: 1 });
    expect(retries).toEqual([2000]);
    // The lock is free again: another holder gets it at once.
    expect((await withQueueLock(async () => 'free', { ifAvailable: true })).ran).toBe(true);
  });

  it('a run still sending when "Sair" starts saves no copy at the end', async () => {
    const fake = fakeLibraryServer();
    await enqueue(queuedCommand(want(1), T1));
    const { flusher } = setup();
    const answered = fake.received.length;
    const run = flusher.flush();
    markLeaving(UID);
    try {
      await run;
      expect(fake.received.length).toBe(answered + 1);
      expect(await store.getSnapshot(UID)).toBeNull();
    } finally {
      clearLeaving(UID);
    }
  });

  it('reports each retry (after the attempt was counted), and not a send that went through', async () => {
    const fake = fakeLibraryServer();
    await enqueue(queuedCommand(want(1), T1));
    const { flusher, onRetry } = setup();
    fake.answerNext(503);
    await flusher.flush();
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect((await store.listQueue(UID))[0]?.attempts).toBe(1);
    await flusher.flush();
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(await store.listQueue(UID)).toEqual([]);
  });

  it('caps the wait between retries at 5 minutes', async () => {
    const fake = fakeLibraryServer();
    fake.offline = true;
    await enqueue(queuedCommand(want(1), T1));
    const { flusher } = setup();
    for (let i = 0; i < 10; i++) await flusher.flush();
    expect(retries).toEqual([2000, 4000, 8000, 16000, 32000, 64000, 128000, 256000, 300000, 300000]);
  });

  it('drops actions older than 30 days before sending, and reports it', async () => {
    const fake = fakeLibraryServer();
    const old = new Date(Date.parse(NOW) - 31 * DAY).toISOString();
    await enqueue(queuedCommand(want(1), old), queuedCommand(want(2), T1));
    const { flusher, settled } = setup();
    await flusher.flush();
    expect(fake.received.map((r) => r.command)).toEqual([want(2)]);
    expect(settled).toEqual([{ sent: 1, rejected: 0, expired: 1 }]);
  });

  it('does nothing while the browser reports being offline', async () => {
    const fake = fakeLibraryServer();
    await enqueue(queuedCommand(want(1), T1));
    reportOnline(false);
    await setup().flusher.flush();
    expect(fake.received).toEqual([]);
    expect(await store.countQueue(UID)).toBe(1);
  });

  it('starts by sending, then sends on `online` and when the tab comes back into view, until stopped', async () => {
    const fake = fakeLibraryServer(applyCommand(EMPTY_LIBRARY, want(9), T1));
    await enqueue(queuedCommand(want(1), T1));
    const { flusher } = setup();
    const stop = flusher.start();
    await vi.waitFor(async () => expect(await store.countQueue(UID)).toBe(0));
    await enqueue(queuedCommand(want(2), T2));
    window.dispatchEvent(new Event('online'));
    await vi.waitFor(async () => expect(await store.countQueue(UID)).toBe(0));
    await enqueue(queuedCommand(want(3), T3));
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.waitFor(async () => expect(await store.countQueue(UID)).toBe(0));
    stop();
    await enqueue(queuedCommand(want(4), T3));
    window.dispatchEvent(new Event('online'));
    document.dispatchEvent(new Event('visibilitychange'));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(await store.countQueue(UID)).toBe(1);
    expect(fake.received).toHaveLength(3);
  });
});
