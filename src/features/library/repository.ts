import type { LibraryCommand } from './commands';
import type { LibraryState } from './types';

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
  subscribe(onChange: () => void): () => void;
  /** Notices for the UI. One raised before anyone listens is delivered to the first listener. */
  onNotice?(listener: (notice: LibraryNotice) => void): () => void;
  /** False when the state only lives in memory (storage blocked or missing). */
  readonly persistent: boolean;
  /** Toast copy for a failed `apply`; the local copy is used when absent. */
  readonly errorMessage?: string;
}
