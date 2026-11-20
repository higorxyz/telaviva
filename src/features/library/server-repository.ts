import type { LibraryCommand } from './commands';
import { NOTICE } from './copy';
import {
  LibraryConflictError,
  LibraryLimitError,
  LibraryRemoteError,
  LibrarySessionError,
  type LibraryNotice,
  type LibraryRepository,
} from './repository';
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

/** One bad row never breaks the UI: rows that fail the schema are dropped, a wrong root shape is an error. */
async function readState(response: Response): Promise<LibraryState> {
  let json: unknown;
  try {
    json = await response.json();
  } catch (cause) {
    throw new LibraryRemoteError('The library response was not JSON', { cause });
  }
  const parsed = parseLibraryEntries(json);
  if (!parsed) throw new LibraryRemoteError('The library response had an unexpected shape');
  return normalizeLibraryState(parsed.state);
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

/** The signed-in user's library, kept on the server. `onUnauthenticated` runs when the session is gone (401). */
export function createServerRepository(opts: { onUnauthenticated: OnUnauthenticated }): LibraryRepository {
  const listeners = new Set<(notice: LibraryNotice) => void>();
  let pending: LibraryNotice | null = null;

  function notify(notice: LibraryNotice) {
    if (listeners.size === 0) pending = notice;
    else listeners.forEach((listener) => listener(notice));
  }

  async function request(path: string, init: RequestInit, retried = false): Promise<Response> {
    let response: Response;
    try {
      response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...init });
    } catch (cause) {
      throw new LibraryRemoteError('Could not reach the library service', { cause });
    }
    if (response.ok) return response;
    if (response.status === 401) {
      // The server applied nothing (it checks the session first), so sending the same request again is safe.
      if (!retried && (await renewed(opts.onUnauthenticated))) return request(path, init, true);
      throw new LibrarySessionError();
    }
    if (response.status === 409) {
      notify('conflict');
      throw new LibraryConflictError();
    }
    if (response.status === 413 && (await readError(response)) === 'limit') {
      notify('limit');
      throw new LibraryLimitError();
    }
    throw new LibraryRemoteError(`The library service answered ${response.status}`);
  }

  return {
    persistent: true,
    errorMessage: NOTICE.saveFailedAccount,

    async load() {
      return readState(await request('/api/library', {}));
    },

    async apply(command: LibraryCommand) {
      const response = await request('/api/library/commands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      });
      return readState(response);
    },

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
