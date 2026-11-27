import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { ToastProvider } from '@/ui/toast/ToastProvider';
import { LibraryProvider } from './LibraryProvider';
import { useLibraryActions, useLibraryEntry } from './hooks';
import { createLocalRepository } from './local-repository';
import { KEY, memStorage, snap } from './test-storage';
import type { TitleRef } from './types';

const movie: TitleRef = { mediaType: 'movie', tmdbId: 550 };

afterEach(() => {
  onlineManager.setOnline(true);
});

function setup(storage: Storage) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <ToastProvider>
        <LibraryProvider repository={createLocalRepository({ storage })}>{children}</LibraryProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
  return renderHook(() => ({ entry: useLibraryEntry(movie), actions: useLibraryActions() }), { wrapper });
}

describe('the library while TanStack Query believes it is offline', () => {
  it("a visitor's action is saved on the device, not held until the connection returns", async () => {
    const { storage, data } = memStorage();
    const { result } = setup(storage);
    await waitFor(() => expect(result.current.entry.ready).toBe(true));
    act(() => onlineManager.setOnline(false));

    act(() =>
      result.current.actions.run({ type: 'setStatus', ref: movie, status: 'want', snapshot: snap('Clube da Luta') }),
    );

    await waitFor(() => expect(JSON.parse(data[KEY] ?? '{"items":[]}').items).toHaveLength(1));
    expect(result.current.entry.item?.status).toBe('want');
  });

  it('the list still loads when the page starts with TanStack Query offline', async () => {
    act(() => onlineManager.setOnline(false));
    const { result } = setup(memStorage().storage);
    await waitFor(() => expect(result.current.entry.ready).toBe(true));
  });
});
