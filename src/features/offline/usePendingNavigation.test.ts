import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetOffline, setOffline } from './test-offline';

const nav = vi.hoisted(() => ({ pathname: '/filmes' }));

vi.mock('next/offline', async () => (await import('./test-offline')).offlineModule);
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }));

import { usePendingNavigation } from './usePendingNavigation';

type LinkOptions = { href?: string; routed?: boolean; init?: MouseEventInit; target?: string };

/** Clicks a link; `routed` (default) stands for next/link, which takes over the navigation (preventDefault). */
function clickLink({ href = '/series', routed = true, init, target }: LinkOptions = {}) {
  const link = document.createElement('a');
  link.href = href;
  if (target) link.target = target;
  const label = document.createElement('span');
  link.append(label);
  document.body.append(link);
  link.addEventListener('click', (event) => {
    if (routed) event.preventDefault();
  });
  // A full load would make jsdom try (and fail) to navigate: cancelled only after the hook's listener has seen it.
  const stopFullLoad = (event: Event) => event.preventDefault();
  window.addEventListener('click', stopFullLoad);
  act(() => {
    label.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init }));
  });
  window.removeEventListener('click', stopFullLoad);
  link.remove();
}

const wait = (ms: number) => act(() => vi.advanceTimersByTime(ms));

describe('usePendingNavigation', () => {
  beforeEach(() => {
    resetOffline();
    nav.pathname = '/filmes';
    window.history.replaceState(null, '', '/filmes');
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('turns true only after 1,500 ms of an in-app navigation pending offline', () => {
    const { result } = renderHook(() => usePendingNavigation());
    setOffline(true);
    clickLink();
    wait(1499);
    expect(result.current).toBe(false);
    wait(1);
    expect(result.current).toBe(true);
  });

  it('takes another delay', () => {
    const { result } = renderHook(() => usePendingNavigation(300));
    setOffline(true);
    clickLink();
    wait(299);
    expect(result.current).toBe(false);
    wait(1);
    expect(result.current).toBe(true);
  });

  it('stays false online, however long the navigation takes', () => {
    const { result } = renderHook(() => usePendingNavigation());
    clickLink();
    wait(5000);
    expect(result.current).toBe(false);
  });

  it('counts a navigation that started just before the connection was found down', () => {
    const { result } = renderHook(() => usePendingNavigation());
    clickLink();
    wait(1600);
    setOffline(true);
    expect(result.current).toBe(true);
  });

  it('goes back to false when the page opens or the connection returns', () => {
    const { result, rerender } = renderHook(() => usePendingNavigation());
    setOffline(true);
    clickLink();
    wait(1500);
    expect(result.current).toBe(true);
    nav.pathname = '/series';
    rerender();
    expect(result.current).toBe(false);

    clickLink({ href: '/buscar' });
    wait(1500);
    expect(result.current).toBe(true);
    setOffline(false);
    expect(result.current).toBe(false);
    setOffline(true);
    expect(result.current).toBe(false);
  });

  it('ignores links the router does not take over: full loads, new tabs, other sites, the same page', () => {
    const { result } = renderHook(() => usePendingNavigation());
    setOffline(true);
    clickLink({ routed: false });
    clickLink({ init: { ctrlKey: true } });
    clickLink({ target: '_blank' });
    clickLink({ href: 'https://example.com/x' });
    clickLink({ href: '/filmes#topo' });
    wait(5000);
    expect(result.current).toBe(false);
  });

  it('does not count a navigation that arrived without a new path (only the query changed)', () => {
    const { result } = renderHook(() => usePendingNavigation());
    setOffline(true);
    clickLink({ href: '/filmes?pagina=2' });
    window.history.pushState(null, '', '/filmes?pagina=2');
    wait(1500);
    expect(result.current).toBe(false);
  });
});
