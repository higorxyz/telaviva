import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, waitFor } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/ui/toast/ToastProvider';
import { applyCommand } from './commands';
import { useLibraryEntry, useLibraryStatus } from './hooks';
import { LIBRARY_KEY, LibraryProvider } from './LibraryProvider';
import type { LibraryRepository } from './repository';
import { EMPTY_LIBRARY, type TitleRef } from './types';

const movie: TitleRef = { mediaType: 'movie', tmdbId: 550 };
const snapshot = { title: 'Clube da Luta', posterPath: null, releaseDate: null, genreIds: [] };
const saved = applyCommand(EMPTY_LIBRARY, { type: 'setStatus', ref: movie, status: 'want', snapshot }, '2026-11-19T12:00:00.000Z');

const repository: LibraryRepository = {
  persistent: true,
  load: async () => saved,
  apply: async () => saved,
  subscribe: () => () => {},
};

function Probe() {
  const status = useLibraryStatus(movie);
  const entry = useLibraryEntry(movie);
  return (
    <span>
      {status.ready ? status.status : 'neutral'}/{entry.ready ? entry.item?.status : 'neutral'}
    </span>
  );
}

const tree = (client: QueryClient) => (
  <QueryClientProvider client={client}>
    <ToastProvider>
      <LibraryProvider repository={repository}>
        <Probe />
      </LibraryProvider>
    </ToastProvider>
  </QueryClientProvider>
);

describe('library hooks during hydration', () => {
  // A Suspense boundary (the home rails) can hydrate after another component already loaded the library: the
  // first client render must still match the server's neutral HTML, or React throws a hydration mismatch.
  it('render the neutral state while hydrating even when the library is already loaded, then the real one', async () => {
    const html = renderToString(tree(new QueryClient()));
    expect(html.replaceAll('<!-- -->', '')).toContain('neutral/neutral');

    const loaded = new QueryClient();
    loaded.setQueryData(LIBRARY_KEY, saved);
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);
    const onRecoverableError = vi.fn();
    await act(async () => {
      hydrateRoot(container, tree(loaded), { onRecoverableError });
    });
    expect(onRecoverableError).not.toHaveBeenCalled();
    await waitFor(() => expect(container.textContent).toBe('want/want'));
    container.remove();
  });
});
