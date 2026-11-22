import { IDBFactory } from 'fake-indexeddb';
import { http, HttpResponse } from 'msw';
import { vi } from 'vitest';
import { server } from '@/test/server';
import { openOfflineStore } from '../offline/store';
import { LIBRARY_CHANNEL, type LibraryMessage } from './queue-sync';
import type { OfflineStore, QueuedCommand } from '../offline/store-types';
import { applyCommand, type LibraryCommand } from './commands';
import { refOfCommand, titlePreImage } from './pre-image';
import { EMPTY_LIBRARY, type LibraryState } from './types';

/** Test helpers for the offline account library: a fake `/api/library` over MSW and a fresh on-device store. */

export const UID = 'ana';
export const SERVER_NOW = '2026-11-21T12:00:00.000Z';

const url = (path: string) => `${window.location.origin}${path}`;

/** What reached POST /api/library/commands (the envelope as sent). */
export type Received = { command: LibraryCommand; at?: string; commandId?: string };

/**
 * The account API with a list in memory, as the real one behaves for these tests: it applies each command with its
 * `at` (or its own clock), answers `{ library, previous }`, and applies a `commandId` only once. `offline` makes every
 * request fail as a network error; `answerNext` makes the next POST answer something else instead.
 */
export function fakeLibraryServer(initial: LibraryState = EMPTY_LIBRARY) {
  const fake = {
    stored: initial,
    offline: false,
    /** Every POST that got an answer, in order (including the ones answered by `answerNext`). */
    received: [] as Received[],
    loads: 0,
    overrides: [] as (() => Response)[],
    answerNext(status: number, error?: string) {
      fake.overrides.push(() => (error ? HttpResponse.json({ error }, { status }) : new HttpResponse(null, { status })));
    },
  };
  const applied = new Set<string>();
  server.use(
    http.get(url('/api/library'), () => {
      if (fake.offline) return HttpResponse.error();
      fake.loads += 1;
      return HttpResponse.json(fake.stored);
    }),
    http.post(url('/api/library/commands'), async ({ request }) => {
      if (fake.offline) return HttpResponse.error();
      const body = (await request.json()) as Received;
      fake.received.push(body);
      const override = fake.overrides.shift();
      if (override) return override();
      const previous = titlePreImage(fake.stored, refOfCommand(body.command));
      if (!body.commandId || !applied.has(body.commandId)) {
        fake.stored = applyCommand(fake.stored, body.command, body.at ?? SERVER_NOW);
        if (body.commandId) applied.add(body.commandId);
      }
      return HttpResponse.json({ library: fake.stored, previous });
    }),
  );
  return fake;
}

/** A store over a fresh fake IndexedDB. Call `vi.unstubAllGlobals()` after each test. */
export async function freshStore(): Promise<OfflineStore> {
  vi.stubGlobal('indexedDB', new IDBFactory());
  return anotherConnection();
}

/** One more connection to the same database, as another tab would open. */
export async function anotherConnection(): Promise<OfflineStore> {
  const store = await openOfflineStore();
  if (!store) throw new Error('the offline store did not open');
  return store;
}

let ids = 0;
/** A distinct uuid for each queued command of a test run. */
export function nextId(): string {
  ids += 1;
  return `00000000-0000-4000-8000-${String(ids).padStart(12, '0')}`;
}

export const queuedCommand = (command: LibraryCommand, at: string, uid = UID): QueuedCommand => ({
  id: nextId(),
  uid,
  command,
  at,
  attempts: 0,
});

/** `navigator.onLine`, as the browser reports it. */
export function reportOnline(online: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(online);
}

/**
 * A Web Locks stand-in (`navigator.locks`) shared by every "tab" of a test: one holder at a time, `ifAvailable`
 * answering null while it is held, the others waiting in order.
 */
export function installFakeLocks() {
  let held = false;
  const waiting: (() => void)[] = [];
  const locks = {
    async request(_name: string, options: { ifAvailable?: boolean }, callback: (lock: object | null) => Promise<unknown>) {
      if (held && options.ifAvailable) return callback(null);
      // A waiter is handed the lock as it is released: `held` stays true in between.
      if (held) await new Promise<void>((resolve) => waiting.push(resolve));
      held = true;
      try {
        return await callback({});
      } finally {
        const next = waiting.shift();
        if (next) next();
        else held = false;
      }
    },
  };
  Object.defineProperty(navigator, 'locks', { value: locks, configurable: true });
  return () => {
    Reflect.deleteProperty(navigator, 'locks');
  };
}

/** What another tab posts on the library channel. */
export function postFromAnotherTab(message: LibraryMessage) {
  const channel = new BroadcastChannel(LIBRARY_CHANNEL);
  channel.postMessage({ ...message, from: 'another-tab' });
  channel.close();
}

/** What another tab hears on the library channel (everything this tab posts); returns what stops listening. */
export function listenAsAnotherTab(onMessage: (message: LibraryMessage) => void): () => void {
  const channel = new BroadcastChannel(LIBRARY_CHANNEL);
  channel.onmessage = (event: MessageEvent<LibraryMessage>) => onMessage({ uid: event.data.uid, kind: event.data.kind });
  return () => channel.close();
}
