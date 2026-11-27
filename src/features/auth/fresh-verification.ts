'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useAuth } from './useAuth';

export const REFRESH_THROTTLE_MS = 30_000;

/**
 * The session cookie froze `email_verified` at sign-in, so ask Firebase again: on mount and whenever the person comes
 * back to this tab (they usually confirm in the mail app or another tab), at most once per 30 s. Used while the
 * e-mail is unconfirmed: by the banner, and on /conta, where the banner stays off.
 */
export function useFreshVerification() {
  const { refresh } = useAuth();
  const last = useRef<number | null>(null);
  const check = useCallback(() => {
    const now = Date.now();
    if (last.current !== null && now - last.current < REFRESH_THROTTLE_MS) return;
    last.current = now;
    refresh().catch(() => {});
  }, [refresh]);
  useEffect(() => {
    check();
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [check]);
}
