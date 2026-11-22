import { createAccountRepository } from './account-repository';
import { createLocalRepository } from './local-repository';
import { createPendingRepository } from './pending-repository';
import type { LibraryRepository } from './repository';
import { createServerRepository, type OnUnauthenticated } from './server-repository';

/** `pending`: sign-in is still resolving; nothing loads and actions do nothing until an identity is known. */
export type LibraryMode = { kind: 'pending' } | { kind: 'guest' } | { kind: 'account'; uid: string };

const retired = new WeakSet<LibraryRepository>();

/**
 * True once the identity that owned `repository` is gone. A mutation started under it may still settle, and
 * its callbacks must then touch neither the new identity's cache nor its toasts.
 */
export function isRetired(repository: LibraryRepository): boolean {
  return retired.has(repository);
}

/** Marks the repository as its identity's (again, after StrictMode's simulated unmount) or as gone. */
export function setRetired(repository: LibraryRepository, gone: boolean): void {
  if (gone) retired.add(repository);
  else retired.delete(repository);
}

export type ModeCallbacks = { onUnauthenticated: OnUnauthenticated; onWrongAccount: () => void };

/**
 * The repository of every identity mode; the account one (offline-capable when the device store opens) ignores a 401
 * or a 409 once its identity is gone.
 */
export function createFor(mode: LibraryMode, callbacks: ModeCallbacks): LibraryRepository {
  if (mode.kind === 'pending') return createPendingRepository();
  if (mode.kind === 'guest') return createLocalRepository();
  const server = createServerRepository({
    uid: mode.uid,
    onUnauthenticated: () => (retired.has(repository) ? Promise.resolve(false) : callbacks.onUnauthenticated()),
    onWrongAccount: () => {
      if (!retired.has(repository)) callbacks.onWrongAccount();
    },
  });
  const repository = createAccountRepository({ server, uid: mode.uid });
  return repository;
}
