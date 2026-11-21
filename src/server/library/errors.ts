/** The command breaks a rule of the reducer (400 `{ error: 'invalid' }`). */
export class LibraryInvalidError extends Error {
  constructor(options?: { cause?: unknown }) {
    super('invalid library command', options);
    this.name = 'LibraryInvalidError';
  }
}

/** An undo found the title changed since the action it undoes (409 `{ error: 'conflict' }`). */
export class LibraryConflictError extends Error {
  constructor() {
    super('the title changed since the action being undone');
    this.name = 'LibraryConflictError';
  }
}

/** The command would take the library past a per-user limit (413 `{ error: 'limit' }`). */
export class LibraryLimitError extends Error {
  constructor(readonly limit: 'items' | 'ratings' | 'marks') {
    super(`library ${limit} limit reached`);
    this.name = 'LibraryLimitError';
  }
}

/**
 * The session's user has no row any more: the account was deleted on another device while this session cookie lived
 * on (401 `{ error: 'unauthenticated' }`, so the client renews the session and, failing, falls back to the visitor).
 */
export class LibraryAccountMissingError extends Error {
  constructor() {
    super('the account has no row');
    this.name = 'LibraryAccountMissingError';
  }
}
