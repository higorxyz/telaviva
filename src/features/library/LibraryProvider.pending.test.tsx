import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { server } from '@/test/server';
import { ToastProvider } from '@/ui/toast/ToastProvider';
import { useLibrary, useLibraryActions } from './hooks';
import { LibraryProvider, type LibraryMode } from './LibraryProvider';
import { item, KEY, want } from './test-storage';
import { EMPTY_LIBRARY } from './types';

const url = (path: string) => `${window.location.origin}${path}`;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function Probe() {
  const { state, ready } = useLibrary();
  const { run } = useLibraryActions();
  return (
    <>
      <span data-testid="lib">{ready ? `itens:${state?.items.length}` : 'carregando'}</span>
      <button onClick={() => run(want(9))}>salvar</button>
      <input aria-label="campo" defaultValue="" />
    </>
  );
}

function setup(first: LibraryMode, onUnauthenticated?: () => Promise<boolean>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = (mode: LibraryMode) => (
    <QueryClientProvider client={client}>
      <ToastProvider>
        <LibraryProvider mode={mode} onUnauthenticated={onUnauthenticated}>
          <Probe />
        </LibraryProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
  const rendered = render(view(first));
  return { client, rerender: (mode: LibraryMode) => rendered.rerender(view(mode)) };
}

const lib = () => screen.getByTestId('lib').textContent;
const guestList = JSON.stringify({ version: 1, items: [item(1), item(2)], episodes: [], ratings: [] });

afterEach(() => window.localStorage.clear());

describe('LibraryProvider pending mode', () => {
  it('is not ready, loads nothing and ignores actions while sign-in is still resolving', async () => {
    window.localStorage.setItem(KEY, guestList);
    const load = vi.fn();
    server.use(http.get(url('/api/library'), () => (load(), HttpResponse.json(EMPTY_LIBRARY))));
    setup({ kind: 'pending' });
    fireEvent.click(screen.getByText('salvar'));
    await act(async () => sleep(30));
    expect(lib()).toBe('carregando');
    expect(load).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(KEY)).toBe(guestList);
  });

  it.each([
    ['the guest', { kind: 'guest' } as LibraryMode, 'itens:2'],
    ['an account', { kind: 'account', uid: 'u1' } as LibraryMode, 'itens:1'],
  ])('moves to %s without remounting the page', async (_name, mode, expected) => {
    window.localStorage.setItem(KEY, guestList);
    server.use(http.get(url('/api/library'), () => HttpResponse.json({ ...EMPTY_LIBRARY, items: [item(7)] })));
    const { rerender } = setup({ kind: 'pending' });
    fireEvent.change(screen.getByLabelText('campo'), { target: { value: 'duna' } });
    rerender(mode);
    expect(await screen.findByText(expected)).toBeInTheDocument();
    expect(screen.getByLabelText('campo')).toHaveValue('duna');
  });

  it('still remounts between two resolved identities', async () => {
    server.use(http.get(url('/api/library'), () => HttpResponse.json(EMPTY_LIBRARY)));
    const { rerender } = setup({ kind: 'pending' });
    rerender({ kind: 'account', uid: 'u1' });
    await screen.findByText('itens:0');
    fireEvent.change(screen.getByLabelText('campo'), { target: { value: 'duna' } });
    rerender({ kind: 'guest' });
    await screen.findByText('itens:0');
    expect(screen.getByLabelText('campo')).toHaveValue('');
  });

  it('ignores a 401 that arrives after its identity is gone', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    server.use(
      http.get(url('/api/library'), async () => {
        await gate;
        return HttpResponse.json({ error: 'unauthenticated' }, { status: 401 });
      }),
    );
    const onUnauthenticated = vi.fn(async () => false);
    const { rerender } = setup({ kind: 'account', uid: 'u1' }, onUnauthenticated);
    await act(async () => sleep(20));
    rerender({ kind: 'guest' });
    await screen.findByText('itens:0');
    release();
    await act(async () => sleep(50));
    expect(onUnauthenticated).not.toHaveBeenCalled();
  });
});
