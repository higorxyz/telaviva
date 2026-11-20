import { episodeCode, type EpisodeRef } from './progress';
import type { LibraryStatus } from './types';
import type { LibraryTab } from './view/library-query';

// The library's user-facing copy (pt-BR), in one place.

export const STATUS_LABEL: Record<LibraryStatus, string> = {
  want: 'Quero ver',
  watching: 'Assistindo',
  watched: 'Assistido',
};

export const TAB_LABEL: Record<LibraryTab, string> = {
  assistindo: 'Assistindo',
  'quero-ver': 'Quero ver',
  assistidos: 'Assistidos',
};

export const UNDO_LABEL = 'Desfazer';

export const NOTICE = {
  saveFailed: 'Não foi possível salvar no navegador. Tente de novo.',
  storageBlocked: 'Seu navegador está bloqueando o armazenamento. A lista vale só até fechar a aba.',
  recovered: 'Recuperamos sua lista, mas alguns itens estavam corrompidos.',
} as const;

/** Messages of the undoable toasts (passed to `run(command, { undoable })`). */
export const UNDOABLE = {
  saved: { message: 'Salvo em Quero ver' },
  removed: { message: 'Removido da sua lista' },
  movedToWatched: { message: 'Movido para Assistidos' },
  ratingRemoved: { message: 'Nota removida' },
  seriesWatched: { message: 'Série marcada como assistida' },
  markedUpTo: (ref: EpisodeRef) => ({ message: `Marcado até ${episodeCode(ref)}` }),
  season: (seasonNumber: number, watched: boolean) => ({
    message: `Temporada ${seasonNumber} ${watched ? 'marcada' : 'desmarcada'}`,
  }),
} as const;
