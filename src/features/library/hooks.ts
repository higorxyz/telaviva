'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useToast } from '@/ui/toast/useToast';
import { applyCommand, findItem, findRating, type LibraryCommand } from './commands';
import { LIBRARY_KEY, useLibraryRepository } from './LibraryProvider';
import type { EpisodeMark, LibraryItem, LibraryState, Rating, TitleRef } from './types';

const NO_MARKS: EpisodeMark[] = [];

export function useLibrary(): { state: LibraryState | undefined; ready: boolean } {
  const repository = useLibraryRepository();
  const { data } = useQuery({
    queryKey: LIBRARY_KEY,
    queryFn: () => repository.load(),
    staleTime: Infinity,
  });
  return { state: data, ready: data !== undefined };
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
      toast.show({ message: 'Não foi possível salvar no navegador. Tente de novo.', tone: 'error' });
    },
    onSuccess: (state, { command, undoable }, context) => {
      // Only the last pending mutation may write; earlier ones would bring back an older state.
      if (queryClient.isMutating({ mutationKey: LIBRARY_KEY }) === 1) {
        queryClient.setQueryData(LIBRARY_KEY, state);
      }
      if (undoable && context.previous) {
        const inverse = inverseOf(context.previous, refOf(command));
        toast.show({
          message: undoable.message,
          action: { label: 'Desfazer', onClick: () => mutation.mutate({ command: inverse }) },
        });
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: LIBRARY_KEY }),
  });

  const { mutate } = mutation;
  const run = useCallback(
    (command: LibraryCommand, opts?: RunOptions) => mutate({ command, undoable: opts?.undoable }),
    [mutate],
  );
  return { run };
}
