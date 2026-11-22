import { openOfflineStore } from '../offline/store';
import type { OfflineStore } from '../offline/store-types';
import { NOTICE } from './copy';
import { createOfflineAccountRepository } from './offline-repository';
import type { AppliedCommand, LibraryRepository } from './repository';
import type { ServerLibraryRepository } from './server-repository';

type Options = {
  server: ServerLibraryRepository;
  uid: string;
  openStore?: () => Promise<OfflineStore | null>;
};

/**
 * The signed-in user's library: the offline one over the on-device store, or, when the store cannot open (no
 * IndexedDB, Safari private mode, a blocked open), exactly the server one, as before offline support. The store opens
 * in the background (a few milliseconds), and every call waits for it, so nothing reaches the server before it is
 * known whether actions should queue.
 */
export function createAccountRepository({ server, uid, openStore = openOfflineStore }: Options): LibraryRepository {
  const ready: Promise<LibraryRepository> = openStore().then(
    (store) => (store ? createOfflineAccountRepository({ server, store, uid }) : server),
    () => server,
  );

  /** A subscription made now, attached once the repository is known; stopping before that cancels it. */
  function attach(subscribe: (target: LibraryRepository) => (() => void) | undefined): () => void {
    let stop: (() => void) | undefined;
    let stopped = false;
    void ready.then((target) => {
      if (!stopped) stop = subscribe(target);
    });
    return () => {
      stopped = true;
      stop?.();
    };
  }

  async function applyWithPreImage(command: Parameters<LibraryRepository['apply']>[0]): Promise<AppliedCommand> {
    const target = await ready;
    if (target.applyWithPreImage) return target.applyWithPreImage(command);
    return { state: await target.apply(command), previous: null };
  }

  return {
    persistent: true,
    remote: true,
    errorMessage: NOTICE.saveFailedAccount,
    load: async () => (await ready).load(),
    apply: async (command) => (await applyWithPreImage(command)).state,
    applyWithPreImage,
    subscribe: (onChange) => attach((target) => target.subscribe(onChange)),
    onNotice: (listener) => attach((target) => target.onNotice?.(listener)),
    queue: {
      count: async () => (await (await ready).queue?.count()) ?? 0,
      subscribe: (onChange) => attach((target) => target.queue?.subscribe(onChange)),
      unqueue: async (id) => (await (await ready).queue?.unqueue(id)) ?? null,
      start: () => attach((target) => target.queue?.start()),
    },
  };
}
