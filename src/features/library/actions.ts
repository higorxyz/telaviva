'use client';

import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useToast } from '@/ui/toast/useToast';
import { applyCommand, type LibraryCommand } from './commands';
import { NOTICE, UNDO_LABEL } from './copy';
import { titleFingerprint } from './fingerprint';
import { isRetired, LIBRARY_KEY, LIBRARY_NETWORK_MODE, LIBRARY_TOAST_TAG, useLibraryRepository } from './LibraryProvider';
import { refOfCommand, titlePreImage, type TitlePreImage } from './pre-image';
import {
  LibraryConflictError,
  LibraryLimitError,
  LibrarySessionError,
  LibraryWrongAccountError,
  type LibraryRepository,
} from './repository';
import type { LibraryState, TitleRef } from './types';

/**
 * The command that puts the title back as `before` holds it. It expects the title (item, rating and marks) as `after`
 * holds it: the state the repository saved for the action, stamped with the repository's own clock (the server's,
 * when signed in), which the optimistic copy cannot know. The server refuses the undo if the title changed since.
 */
function inverseOf(before: TitlePreImage, after: LibraryState, ref: TitleRef): LibraryCommand {
  return { type: 'restore', ref, ...before, expected: titleFingerprint(after, ref) };
}

interface RunOptions {
  undoable?: { message: string };
}

interface Variables {
  command: LibraryCommand;
  /** The repository the command was issued against: it must survive an identity change while it runs. */
  repository: LibraryRepository;
  undoable?: { message: string };
  /** An undo of an action from the offline queue: it leaves the queue, or, already sent, `command` puts it back. */
  unqueue?: string;
}

/**
 * What a mutation resolves to. `previous` undefined: the repository does not know it (the cache is used). `queued`:
 * the action waits in the offline queue (see AppliedCommand).
 */
type Saved = { state: LibraryState; previous?: TitlePreImage | null; queued?: { id: string; previous: TitlePreImage } };

/** Whether another library mutation ran at some point while this one did. */
type Flight = { overlapped: boolean };

interface Context {
  previous: LibraryState | undefined;
  repository: LibraryRepository;
  flight: Flight;
}

/** The library mutations in flight, per query client (every component's `useLibraryActions` shares the cache). */
const inFlight = new WeakMap<QueryClient, Set<Flight>>();

function takeOff(client: QueryClient): Flight {
  const flights = inFlight.get(client) ?? new Set<Flight>();
  inFlight.set(client, flights);
  const flight = { overlapped: flights.size > 0 };
  for (const other of flights) other.overlapped = true;
  flights.add(flight);
  return flight;
}

function apply(target: LibraryRepository, command: LibraryCommand): Promise<Saved> {
  if (target.applyWithPreImage) return target.applyWithPreImage(command);
  return target.apply(command).then((state) => ({ state }));
}

/** An undo of a queued action: out of the queue, nothing sent; if it went out meanwhile, the restore is sent. */
async function undoQueued(target: LibraryRepository, id: string, restore: LibraryCommand): Promise<Saved> {
  const state = await target.queue?.unqueue(id);
  return state ? { state } : apply(target, restore);
}

export function useLibraryActions(): { run(command: LibraryCommand, opts?: RunOptions): void } {
  const repository = useLibraryRepository();
  const queryClient = useQueryClient();
  const toast = useToast();

  const mutation = useMutation<Saved, Error, Variables, Context>({
    mutationKey: LIBRARY_KEY,
    networkMode: LIBRARY_NETWORK_MODE,
    mutationFn: ({ command, repository: target, unqueue }) =>
      unqueue ? undoQueued(target, unqueue, command) : apply(target, command),
    onMutate: async ({ command, repository: target }) => {
      const flight = takeOff(queryClient);
      await queryClient.cancelQueries({ queryKey: LIBRARY_KEY });
      // The identity changed while this waited: the cache now belongs to the next identity.
      if (isRetired(target)) return { previous: undefined, repository: target, flight };
      const previous = queryClient.getQueryData<LibraryState>(LIBRARY_KEY);
      if (previous) {
        try {
          queryClient.setQueryData(LIBRARY_KEY, applyCommand(previous, command, new Date().toISOString()));
        } catch {
          // The repository rejects the same command and onError restores the state.
        }
      }
      return { previous, repository: target, flight };
    },
    onError: (error, _variables, context) => {
      // The identity changed while this ran: its cache is gone, and neither rollback nor toast belongs to the new one.
      if (context && isRetired(context.repository)) return;
      if (context?.previous) queryClient.setQueryData(LIBRARY_KEY, context.previous);
      // These have their own message: the auth flow (session, wrong account: the identity switches), or the
      // repository's notice toast (conflict, limit).
      if (
        error instanceof LibrarySessionError ||
        error instanceof LibraryWrongAccountError ||
        error instanceof LibraryConflictError ||
        error instanceof LibraryLimitError
      ) {
        return;
      }
      toast.show({ message: (context?.repository ?? repository).errorMessage ?? NOTICE.saveFailed, tone: 'error' });
    },
    onSuccess: (saved, { command, undoable }, context) => {
      // No cache write here: the optimistic value already holds, and an older response could revert it.
      if (isRetired(context.repository) || !undoable) return;
      const ref = refOfCommand(command);
      // Signed in, the title as the server saw it right before the command (queued: as this device saw it); as a
      // visitor, the cache's copy.
      let before = context.previous ? titlePreImage(context.previous, ref) : null;
      if (saved.queued) before = saved.queued.previous;
      else if (saved.previous !== undefined) before = saved.previous;
      if (!before) return;
      const inverse = inverseOf(before, saved.state, ref);
      toast.show({
        message: undoable.message,
        tag: LIBRARY_TOAST_TAG,
        action: {
          label: UNDO_LABEL,
          onClick: () => {
            if (isRetired(context.repository)) return;
            mutation.mutate({ command: inverse, repository: context.repository, unqueue: saved.queued?.id });
          },
        },
      });
    },
    onSettled: (saved, _error, _variables, context) => {
      if (context) inFlight.get(queryClient)?.delete(context.flight);
      // Only the last pending mutation refreshes the cache (it counts itself).
      if (queryClient.isMutating({ mutationKey: LIBRARY_KEY }) !== 1) return;
      // Signed in, the answer is the whole list as stored after this write: no need to load it again, unless another
      // mutation overlapped (its write may have landed after this answer was read) or a load is in flight (it may have
      // read the list before the write; invalidating cancels it and loads again).
      const own =
        context &&
        !isRetired(context.repository) &&
        context.repository.remote &&
        !context.flight.overlapped &&
        queryClient.isFetching({ queryKey: LIBRARY_KEY }) === 0;
      if (saved && own) queryClient.setQueryData(LIBRARY_KEY, saved.state);
      // Not awaited, so it never extends the pending state.
      else void queryClient.invalidateQueries({ queryKey: LIBRARY_KEY });
    },
  });

  const { mutate } = mutation;
  const run = useCallback(
    (command: LibraryCommand, opts?: RunOptions) => {
      // Sign-in is still resolving: the UI is not ready (actions are disabled), and nothing may be written yet.
      if (repository.pending) return;
      mutate({ command, repository, undoable: opts?.undoable });
    },
    [mutate, repository],
  );
  return { run };
}
