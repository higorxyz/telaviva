'use client';

import { useIsOffline } from '@/features/offline/useIsOffline';
import { useEffect, useRef, useState } from 'react';
import { NEEDS_NETWORK } from '@/features/offline/copy';
import { authErrorCode, authErrorMessage } from './errors';
import { useAuth } from './useAuth';

export const RESEND_LABEL = 'Reenviar e-mail';
export const RESENT = 'E-mail enviado.';
export const RESEND_COOLDOWN_MS = 60_000;

/**
 * "Reenviar e-mail", shared by the verification banner and /conta: sends the confirmation again, says how it went,
 * and waits 60 s before allowing another try only after Firebase answered "too many requests" (anything else, being
 * offline say, can be retried at once). `cooling` is for `aria-disabled`, so the button keeps its focus.
 */
export function useResendVerification(): { resend(): Promise<void>; cooling: boolean; message: string | null } {
  const { sendVerification } = useAuth();
  const offline = useIsOffline();
  const [cooling, setCooling] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(timer.current);
    };
  }, []);

  async function resend() {
    if (cooling) return;
    // Not sent, so no cooldown: it can be tried again as soon as the connection is back.
    if (offline) return setMessage(NEEDS_NETWORK);
    setCooling(true);
    setMessage(null);
    let cool = true;
    try {
      await sendVerification();
      if (mounted.current) setMessage(RESENT);
    } catch (error) {
      cool = authErrorCode(error) === 'auth/too-many-requests';
      if (mounted.current) setMessage(authErrorMessage(error));
    }
    if (!mounted.current) return;
    if (cool) timer.current = setTimeout(() => setCooling(false), RESEND_COOLDOWN_MS);
    else setCooling(false);
  }

  return { resend, cooling, message };
}
