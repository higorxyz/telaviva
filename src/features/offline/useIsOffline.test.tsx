import { act, renderHook } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetOffline, setOffline } from './test-offline';

vi.mock('next/offline', async () => (await import('./test-offline')).offlineModule);

import { useIsOffline } from './useIsOffline';

function Probe() {
  return <p>{useIsOffline() ? 'offline' : 'online'}</p>;
}

describe('useIsOffline', () => {
  beforeEach(() => resetOffline());
  afterEach(() => vi.restoreAllMocks());

  it('follows next/offline', () => {
    const { result } = renderHook(() => useIsOffline());
    expect(result.current).toBe(false);
    setOffline(true);
    expect(result.current).toBe(true);
  });

  it('is true at mount when the browser already reports being offline, and follows its events', () => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const { result } = renderHook(() => useIsOffline());
    expect(result.current).toBe(true);
    online.mockReturnValue(true);
    act(() => void window.dispatchEvent(new Event('online')));
    expect(result.current).toBe(false);
  });

  it('renders as online on the server, whatever the browser says', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    expect(renderToString(<Probe />)).toContain('online');
  });
});
