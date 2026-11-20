import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ToastProvider } from '@/ui/toast/ToastProvider';
import { LibraryProvider } from './LibraryProvider';
import { createLocalRepository } from './local-repository';
import type { LibraryNotice, LibraryRepository } from './repository';
import { item, KEY, memStorage } from './test-storage';
import { EMPTY_LIBRARY } from './types';

const RECOVERED = 'Recuperamos sua lista, mas alguns itens estavam corrompidos.';

function renderWith(repository: LibraryRepository) {
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <LibraryProvider repository={repository}>
          <span>conteúdo</span>
        </LibraryProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('LibraryProvider notices', () => {
  it('shows the recovery toast once, however many times the repository reports it', () => {
    let emit: (notice: LibraryNotice) => void = () => {};
    renderWith({
      persistent: true,
      load: async () => EMPTY_LIBRARY,
      apply: async () => EMPTY_LIBRARY,
      subscribe: () => () => {},
      onNotice: (listener) => {
        emit = listener;
        return () => {};
      },
    });
    act(() => emit('recovered'));
    act(() => emit('recovered'));
    expect(screen.getAllByText(RECOVERED)).toHaveLength(1);
  });

  it('shows it for a real local library whose rows were partly corrupt, loaded before the provider listened', async () => {
    const raw = JSON.stringify({ version: 1, items: [item(1), { broken: true }], episodes: [], ratings: [] });
    const repository = createLocalRepository({ storage: memStorage({ [KEY]: raw }).storage });
    await repository.load();
    renderWith(repository);
    expect(await screen.findByText(RECOVERED)).toBeInTheDocument();
  });
});
