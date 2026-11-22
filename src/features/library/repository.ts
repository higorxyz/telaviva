import type { LibraryCommand } from './commands';
import type { TitlePreImage } from './pre-image';
import type { LibraryState } from './types';

/**
 * What `applyWithPreImage` answers: the list as stored, and the title as it was right before the command (null when
 * it could not be read: then no undo is offered).
 *
 * `queued`: the command did not reach the server and waits in the offline queue (`state` is the saved copy with the
 * queue on top). Its undo takes it out of the queue (`LibraryQueue.unqueue`); once it has been sent, the undo puts
 * back `previous`, the title as this device saw it before the command.
 */
export type AppliedCommand = {
  state: LibraryState;
  previous: TitlePreImage | null;
  queued?: { id: string; previous: TitlePreImage };
};

/**
 * `recovered`: some saved rows were unreadable; they were backed up and the rest of the library loaded.
 * `conflict`: the account's list changed on another device while a command was running.
 * `limit`: the account's list reached a size limit.
 * `queueRejected`: the server refused an action from the offline queue, which was dropped.
 * `queueExpired`: actions older than 30 days were dropped from the offline queue unsent.
 */
export type LibraryNotice = 'recovered' | 'conflict' | 'limit' | 'queueRejected' | 'queueExpired';

/** The session ended (or never existed): the account repository could not be used. */
export class LibrarySessionError extends Error {
  constructor() {
    super('The session is not valid');
    this.name = 'LibrarySessionError';
  }
}

/** The list changed elsewhere, so the command was refused. */
export class LibraryConflictError extends Error {
  constructor() {
    super('The library changed on another device');
    this.name = 'LibraryConflictError';
  }
}

/**
 * The session now belongs to another account than this library's (another tab switched accounts): nothing was read
 * or written, and sign-in is asked to catch up, which moves this tab to the other identity.
 */
export class LibraryWrongAccountError extends Error {
  constructor() {
    super('The session belongs to another account');
    this.name = 'LibraryWrongAccountError';
  }
}

/** The account reached a size limit. */
export class LibraryLimitError extends Error {
  constructor() {
    super('The library reached its size limit');
    this.name = 'LibraryLimitError';
  }
}

type RemoteErrorOptions = { cause?: unknown; network?: boolean; status?: number; code?: string };

/**
 * Any other failure talking to the account API. `network`: the request never got an answer (offline, DNS, a dropped
 * connection), which is what the offline queue holds on to; otherwise `status` (and the body's `error`, as `code`)
 * say what the server answered, or both are null when the answer itself was unreadable.
 */
export class LibraryRemoteError extends Error {
  readonly network: boolean;
  readonly status: number | null;
  readonly code: string | null;
  constructor(message: string, options: RemoteErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = 'LibraryRemoteError';
    this.network = options.network ?? false;
    this.status = options.status ?? null;
    this.code = options.code ?? null;
  }
}

/** True when the account API could not be reached at all (not when it answered with an error). */
export function isNetworkError(error: unknown): boolean {
  return error instanceof LibraryRemoteError && error.network;
}

/**
 * The offline queue of an account library, as the UI sees it. `count` and `subscribe` follow the actions waiting to
 * be sent (in this tab and the others); `unqueue` takes one out before it is sent, resolving to the list as it then
 * stands, or null when it was already sent; `start` begins sending (on mount, `online`, the tab coming back) and
 * returns what stops it.
 */
export interface LibraryQueue {
  count(): Promise<number>;
  subscribe(onChange: () => void): () => void;
  unqueue(id: string): Promise<LibraryState | null>;
  start(): () => void;
}

export interface LibraryRepository {
  load(): Promise<LibraryState>;
  apply(command: LibraryCommand): Promise<LibraryState>;
  /**
   * `apply`, also answering the title's pre-image as the store saw it. Only the account repository has it: undo
   * builds from it, so a tab open for hours never reverts another device's change. Without it, undo uses the cache.
   */
  applyWithPreImage?(command: LibraryCommand): Promise<AppliedCommand>;
  subscribe(onChange: () => void): () => void;
  /** Notices for the UI. One raised before anyone listens is delivered to the first listener. */
  onNotice?(listener: (notice: LibraryNotice) => void): () => void;
  /** False when the state only lives in memory (storage blocked or missing). */
  readonly persistent: boolean;
  /** Toast copy for a failed `apply`; the local copy is used when absent. */
  readonly errorMessage?: string;
  /**
   * True when the list lives on a server: each apply answers the whole list as stored, which the cache may take
   * instead of loading the list again.
   */
  readonly remote?: boolean;
  /** True while sign-in is resolving: hooks load nothing and ignore actions. */
  readonly pending?: boolean;
  /** Signed in with the on-device store: actions that could not reach the server wait here. */
  readonly queue?: LibraryQueue;
}
