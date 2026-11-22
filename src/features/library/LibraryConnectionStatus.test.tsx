import 'fake-indexeddb/auto';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/ui/toast/ToastProvider';
import { LibraryConnectionStatus } from './LibraryConnectionStatus';
import { LibraryProvider } from './LibraryProvider';
import { createOfflineAccountRepository } from './offline-repository';
import { createServerRepository } from './server-repository';
import { fakeLibraryServer, freshStore, queuedCommand, reportOnline, UID } from './test-library-server';
import { want } from './test-storage';

vi.mock('next/offline', async () => (await import('@/features/offline/test-offline')).offlineModule);
vi.mock('next/navigation', () => ({ usePathname: () => '/minha-lista' }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('LibraryConnectionStatus', () => {
  it('shows the account’s queued actions in the connection indicator', async () => {
    fakeLibraryServer();
    const store = await freshStore();
    await store.enqueue(queuedCommand(want(1), '2026-11-21T09:00:00.000Z'));
    await store.enqueue(queuedCommand(want(2), '2026-11-21T09:00:00.000Z'));
    reportOnline(false);
    const server = createServerRepository({ uid: UID, onUnauthenticated: async () => false });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ToastProvider>
          <LibraryProvider repository={createOfflineAccountRepository({ server, store, uid: UID })}>
            <LibraryConnectionStatus />
          </LibraryProvider>
        </ToastProvider>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('2 ações aguardando envio')).toBeInTheDocument();
    expect(screen.getByText('Sem conexão. Suas ações serão enviadas quando a internet voltar.')).toBeInTheDocument();
  });

  it('counts nothing for a visitor', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ToastProvider>
          <LibraryProvider>
            <LibraryConnectionStatus />
          </LibraryProvider>
        </ToastProvider>
      </QueryClientProvider>,
    );
    await vi.waitFor(() => expect(document.querySelector('[data-connection-status]')).not.toBeNull());
    expect(document.querySelector('[data-connection-status]')).toBeEmptyDOMElement();
  });
});
