'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useSyncExternalStore } from 'react';
import { useToast } from '@/ui/toast/useToast';
import { applyCommand, findItem, findRating, type LibraryCommand } from './commands';
import { NOTICE, UNDO_LABEL } from './copy';
import { LIBRARY_KEY, useLibraryRepository } from './LibraryProvider';
import type { EpisodeMark, LibraryItem, LibraryState, LibraryStatus, Rating, TitleRef } from './types';

const NO_MARKS: EpisodeMark[] = [];

const noopSubscribe = () => () => {};

/**
 * False on the server and while hydrating (React reads the server snapshot then), true afterwards. A boundary that
 * hydrates late (the home rails, behind Suspense) may find the library already loaded by another component; it
 * must still render the server's neutral state first, or React reports a hydration mismatch.
 */
function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

export function useLibrary(): { state: LibraryState | undefined; ready: boolean } {
  const repository = useLibraryRepository();
  const { data } = useQuery({
    queryKey: LIBRARY_KEY,
    queryFn: () => repository.load(),
    staleTime: Infinity,
  });
  const hydrated = useHydrated();
  return hydrated ? { state: data, ready: data !== undefined } : { state: undefined, ready: false };
}

export function useLibraryEntry(ref: TitleRef): {
  ready: boolean;
  item: LibraryItem | null;
  rating: Rating | null;
  marks: EpisodeMark[];
} {
  const { state, ready } = useLibrary();
  if (!state) return { ready, item: null, rating: null, marks: NO_MARKS };
  const marks =
    ref.mediaType === 'tv' ? state.episodes.filter((e) => e.tvId === ref.tmdbId) : NO_MARKS;
  return {
    ready,
    item: findItem(state, ref) ?? null,
    rating: findRating(state, ref) ?? null,
    marks,
  };
}

/**
 * Status of one title. The query selects only that status, so a card re-renders when its own
 * entry changes and not on every library write.
 */
export function useLibraryStatus(ref: TitleRef): { ready: boolean; status: LibraryStatus | null } {
  const repository = useLibraryRepository();
  const { data } = useQuery({
    queryKey: LIBRARY_KEY,
    queryFn: () => repository.load(),
    staleTime: Infinity,
    select: (state): LibraryStatus | null => findItem(state, ref)?.status ?? null,
  });
  const hydrated = useHydrated();
  return hydrated ? { ready: data !== undefined, status: data ?? null } : { ready: false, status: null };
}

function refOf(command: LibraryCommand): TitleRef {
  return command.type === 'setEpisodes' ? { mediaType: 'tv', tmdbId: command.tvId } : command.ref;
}

/** The command that puts the title back as it is in `state`. */
function inverseOf(state: LibraryState, ref: TitleRef): LibraryCommand {
  return {
    type: 'restore',
    ref,
    item: findItem(state, ref) ?? null,
    rating: findRating(state, ref) ?? null,
    marks: ref.mediaType === 'tv' ? state.episodes.filter((e) => e.tvId === ref.tmdbId) : [],
  };
}

interface RunOptions {
  undoable?: { message: string };
}

interface Variables {
  command: LibraryCommand;
  undoable?: { message: string };
}

interface Context {
  previous: LibraryState | undefined;
}

export function useLibraryActions(): { run(command: LibraryCommand, opts?: RunOptions): void } {
  const repository = useLibraryRepository();
  const queryClient = useQueryClient();
  const toast = useToast();

  const mutation = useMutation<LibraryState, Error, Variables, Context>({
    mutationKey: LIBRARY_KEY,
    mutationFn: ({ command }) => repository.apply(command),
    onMutate: async ({ command }) => {
      await queryClient.cancelQueries({ queryKey: LIBRARY_KEY });
      const previous = queryClient.getQueryData<LibraryState>(LIBRARY_KEY);
      if (previous) {
        try {
          queryClient.setQueryData(LIBRARY_KEY, applyCommand(previous, command, new Date().toISOString()));
        } catch {
          // The repository rejects the same command and onError restores the state.
        }
      }
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(LIBRARY_KEY, context.previous);
      toast.show({ message: NOTICE.saveFailed, tone: 'error' });
    },
    onSuccess: (_state, { command, undoable }, context) => {
      // No cache write here: the optimistic value already holds, and an older response could revert it.
      if (undoable && context.previous) {
        const inverse = inverseOf(context.previous, refOf(command));
        toast.show({
          message: undoable.message,
          action: { label: UNDO_LABEL, onClick: () => mutation.mutate({ command: inverse }) },
        });
      }
    },
    onSettled: () => {
      // Only the last pending mutation reloads (it counts itself); not awaited, so it never extends the pending state.
      if (queryClient.isMutating({ mutationKey: LIBRARY_KEY }) === 1) {
        void queryClient.invalidateQueries({ queryKey: LIBRARY_KEY });
      }
    },
  });

  const { mutate } = mutation;
  const run = useCallback(
    (command: LibraryCommand, opts?: RunOptions) => mutate({ command, undoable: opts?.undoable }),
    [mutate],
  );
  return { run };
}
