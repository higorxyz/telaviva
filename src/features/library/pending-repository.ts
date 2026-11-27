import type { LibraryRepository } from './repository';

const never = <T,>() => new Promise<T>(() => {});

/**
 * Stands in while sign-in is still resolving (the `tv_auth` hint is set, `/api/auth/me` has not answered). Hooks see
 * `pending` and neither load nor run commands, so nothing can be written to the wrong identity's library.
 */
export function createPendingRepository(): LibraryRepository {
  return {
    pending: true,
    persistent: true,
    load: never,
    apply: never,
    subscribe: () => () => {},
  };
}
