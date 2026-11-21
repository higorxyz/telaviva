import type { LibraryCommand } from './commands';
import type { TitlePreImage } from './pre-image';
import type { LibraryState } from './types';

/**
 * What `applyWithPreImage` answers: the list as stored, and the title as it was right before the command (null when
 * it could not be read: then no undo is offered).
 */
export type AppliedCommand = { state: LibraryState; previous: TitlePreImage | null };

/**
 * `recovered`: some saved rows were unreadable; they were backed up and the rest of the library loaded.
 * `conflict`: the account's list changed on another device while a command was running.
 * `limit`: the account's list reached a size limit.
 */
export type LibraryNotice = 'recovered' | 'conflict' | 'limit';

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

/** Any other failure talking to the account API. */
export class LibraryRemoteError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'LibraryRemoteError';
  }
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
}
