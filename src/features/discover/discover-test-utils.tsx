import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Activity } from 'react';
import { afterEach, beforeAll, beforeEach, vi } from 'vitest';
import { movie } from '@/test/media';
import { server } from '@/test/server';
import { DiscoverView } from './DiscoverView';
import type { DiscoverCatalog } from './labels';
import { APPLY_DELAY_MS } from './useDiscoverFilters';

/** Shared by the two DiscoverView suites. Each suite mocks `next/navigation` with `useSearchParams: () => harness.params`. */
export const harness = { params: new URLSearchParams() };

export const catalog: DiscoverCatalog = {
  genres: {
    movie: [{ id: 28, name: 'Ação' }, { id: 18, name: 'Drama' }],
    tv: [{ id: 18, name: 'Drama' }, { id: 10759, name: 'Ação e Aventura' }],
  },
  providers: {
    movie: [{ id: 8, name: 'Netflix', logoPath: '/n.jpg' }],
    tv: [{ id: 8, name: 'Netflix', logoPath: '/n.jpg' }],
  },
};

export const seen: URLSearchParams[] = [];

export function respond(results: unknown[] = [movie({ id: 603, title: 'Matrix' })]) {
  server.use(
    http.get(`${window.location.origin}/api/discover`, ({ request }) => {
      seen.push(new URL(request.url).searchParams);
      return HttpResponse.json({ page: 1, totalPages: 1, totalResults: results.length, results });
    }),
  );
}

let rerenderTree: (mode?: 'visible' | 'hidden') => void = () => {};
export const rerenderView = (mode?: 'visible' | 'hidden') => rerenderTree(mode);

export function setup(qs: string) {
  harness.params = new URLSearchParams(qs);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tree = (mode: 'visible' | 'hidden' = 'visible') => (
    <QueryClientProvider client={client}>
      <Activity mode={mode}>
        <DiscoverView catalog={catalog} />
      </Activity>
    </QueryClientProvider>
  );
  const { rerender } = render(tree());
  rerenderTree = (mode) => act(() => rerender(tree(mode)));
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
}

export const toolbar = () => screen.getByRole('search', { name: 'Filtros' });
/** A toolbar trigger by its label, with or without the value summary ("Ano", "Ano · 2010–2019"). */
export const trigger = (label: string) =>
  within(toolbar()).getByRole('button', { name: new RegExp('^' + label + '( · .+)?$') });
/** A trigger's panel, found through aria-controls (a closed <dialog> is display:none, so it has no accessible name). */
export const panel = (name: string) =>
  document.getElementById(trigger(name).getAttribute('aria-controls')!) as HTMLDialogElement;
export const lastUrl = (spy: { mock: { calls: unknown[][] } }) => String(spy.mock.calls.at(-1)?.[2]);
/** Runs the debounced apply (and any stray one) deterministically, without waiting real time. */
export const flushApply = () => act(() => void vi.advanceTimersByTime(APPLY_DELAY_MS * 2));

export const viewport = {
  mq: { matches: true, addEventListener: (() => {}) as (type: string, cb: () => void) => void, removeEventListener: () => {} },
  onChange: () => {},
};

/** Registers the dialog polyfill and per-test setup/teardown (fake timers that still advance on their own). */
export function installDiscoverHarness(): { replace: () => ReturnType<typeof vi.spyOn> } {
  let replace: ReturnType<typeof vi.spyOn>;
  beforeAll(() => {
    HTMLDialogElement.prototype.show = function show() {
      this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.close = function close() {
      if (!this.hasAttribute('open')) return;
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    };
  });
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    seen.length = 0;
    replace = vi.spyOn(window.history, 'replaceState');
    viewport.mq = {
      matches: true,
      addEventListener: (_t, cb) => (viewport.onChange = cb),
      removeEventListener: () => {},
    };
    vi.stubGlobal('matchMedia', () => viewport.mq);
    vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} });
    respond();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
  return { replace: () => replace };
}
