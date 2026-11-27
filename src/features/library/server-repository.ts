import { requestDeadline, type RequestDeadline } from '@/lib/request-timeout';
import type { LibraryCommand } from './commands';
import { NOTICE } from './copy';
import {
  LibraryConflictError,
  LibraryLimitError,
  LibraryRemoteError,
  LibrarySessionError,
  LibraryWrongAccountError,
  type AppliedCommand,
  type LibraryNotice,
  type LibraryRepository,
} from './repository';
import { parsePreImage } from './pre-image';
import { normalizeLibraryState, parseLibraryEntries } from './schema';
import type { LibraryState } from './types';

const REFOCUS_THROTTLE_MS = 30_000;

async function readError(response: Response): Promise<string | undefined> {
  try {
    const body: unknown = await response.json();
    if (typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string') {
      return body.error;
    }
  } catch {
    // No JSON body: the status alone decides.
  }
  return undefined;
}

/** The body; one cut off by the deadline is no answer (`network`), like a request that never got one. */
async function readJson(response: Response, deadline: RequestDeadline): Promise<unknown> {
  try {
    return await response.json();
  } catch (cause) {
    if (deadline.expired) throw new LibraryRemoteError('The library service did not answer in time', { cause, network: true });
    throw new LibraryRemoteError('The library response was not JSON', { cause });
  }
}

/** One bad row never breaks the UI: rows that fail the schema are dropped, a wrong root shape is an error. */
function toState(json: unknown): LibraryState {
  const parsed = parseLibraryEntries(json);
  if (!parsed) throw new LibraryRemoteError('The library response had an unexpected shape');
  return normalizeLibraryState(parsed.state);
}

/** `{ library, previous }`, as POST /api/library/commands answers it. */
function toApplied(json: unknown): AppliedCommand {
  const body = typeof json === 'object' && json !== null ? (json as { library?: unknown; previous?: unknown }) : {};
  return { state: toState(body.library), previous: parsePreImage(body.previous) };
}

/**
 * What to do when the session is gone (401). Resolving `true` means the session was renewed for the same user, so the
 * request is sent once more; anything else rejects with LibrarySessionError.
 */
export type OnUnauthenticated = () => void | Promise<boolean>;

async function renewed(onUnauthenticated: OnUnauthenticated): Promise<boolean> {
  try {
    return (await onUnauthenticated()) === true;
  } catch {
    return false;
  }
}

/**
 * What the offline queue adds to a command: `at`, when it was done on the device (the server writes it with that
 * time, so a late write never undoes a newer change), and `commandId`, which makes a resend a no-op.
 */
export type CommandEnvelope = { at?: string; commandId?: string };

/** The account repository: its writes also take the queue's envelope. */
export interface ServerLibraryRepository extends LibraryRepository {
  apply(command: LibraryCommand, envelope?: CommandEnvelope): Promise<LibraryState>;
  applyWithPreImage(command: LibraryCommand, envelope?: CommandEnvelope): Promise<AppliedCommand>;
}

type Options = {
  /** The account this library belongs to, sent as `X-Expected-User` with every request. */
  uid: string;
  onUnauthenticated: OnUnauthenticated;
  /** The session belongs to someone else now (409 `wrong_account`): sign-in should look again at who is in. */
  onWrongAccount?: () => void;
};

/**
 * The signed-in user's library, kept on the server. Every request names the account it is for: the session cookie is
 * shared by all tabs, so another tab may have switched accounts, and the server then refuses (409 `wrong_account`)
 * instead of loading or writing someone else's list. `onUnauthenticated` runs when the session is gone (401).
 */
export function createServerRepository(opts: Options): ServerLibraryRepository {
  const listeners = new Set<(notice: LibraryNotice) => void>();
  let pending: LibraryNotice | null = null;

  function notify(notice: LibraryNotice) {
    if (listeners.size === 0) pending = notice;
    else listeners.forEach((listener) => listener(notice));
  }

  type Init = Omit<RequestInit, 'headers' | 'signal'> & { headers?: Record<string, string> };

  /**
   * One request and its JSON body, given up on after REQUEST_TIMEOUT_MS (src/lib/request-timeout.ts): a connection
   * with signal but no data then fails as no answer (`network: true`), so the offline fallbacks start (the saved copy,
   * the queue with the same `commandId`) and a send never holds the queue lock for long. Each attempt has its own
   * deadline (the 401 renewal in between has its own requests).
   */
  async function request(path: string, init: Init, retried = false): Promise<unknown> {
    const deadline = requestDeadline();
    let response: Response;
    try {
      try {
        response = await fetch(path, {
          credentials: 'same-origin',
          cache: 'no-store',
          ...init,
          headers: { ...init.headers, 'X-Expected-User': opts.uid },
          signal: deadline.signal,
        });
      } catch (cause) {
        throw new LibraryRemoteError('Could not reach the library service', { cause, network: true });
      }
      if (response.ok) return await readJson(response, deadline);
    } finally {
      deadline.clear();
    }
    if (response.status === 401) {
      // The server applied nothing (it checks the session first), so sending the same request again is safe.
      if (!retried && (await renewed(opts.onUnauthenticated))) return request(path, init, true);
      throw new LibrarySessionError();
    }
    // The error body is optional: past the deadline (cleared above) it is read without one, and a hang there is rare.
    const code = await readError(response);
    if (response.status === 409) {
      if (code === 'wrong_account') {
        opts.onWrongAccount?.();
        throw new LibraryWrongAccountError();
      }
      notify('conflict');
      throw new LibraryConflictError();
    }
    if (response.status === 413 && code === 'limit') {
      notify('limit');
      throw new LibraryLimitError();
    }
    throw new LibraryRemoteError(`The library service answered ${response.status}`, {
      status: response.status,
      ...(code ? { code } : {}),
    });
  }

  async function applyWithPreImage(command: LibraryCommand, envelope: CommandEnvelope = {}): Promise<AppliedCommand> {
    const { at, commandId } = envelope;
    const json = await request('/api/library/commands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, ...(at ? { at } : {}), ...(commandId ? { commandId } : {}) }),
    });
    return toApplied(json);
  }

  return {
    persistent: true,
    remote: true,
    errorMessage: NOTICE.saveFailedAccount,

    async load() {
      return toState(await request('/api/library', {}));
    },

    async apply(command: LibraryCommand, envelope?: CommandEnvelope) {
      return (await applyWithPreImage(command, envelope)).state;
    },

    applyWithPreImage,

    subscribe(onChange) {
      if (typeof document === 'undefined') return () => {};
      let last = Date.now();
      const handler = () => {
        if (document.visibilityState !== 'visible') return;
        const now = Date.now();
        if (now - last < REFOCUS_THROTTLE_MS) return;
        last = now;
        onChange();
      };
      document.addEventListener('visibilitychange', handler);
      return () => document.removeEventListener('visibilitychange', handler);
    },

    onNotice(listener) {
      listeners.add(listener);
      if (pending) {
        const notice = pending;
        pending = null;
        listener(notice);
      }
      return () => listeners.delete(listener);
    },
  };
}
