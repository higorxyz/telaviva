'use client';

import { X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { authErrorCode, authErrorMessage } from './errors';
import { useAuth } from './useAuth';

export const VERIFY_TEXT = 'Confirme seu e-mail para proteger sua conta.';
export const RESEND_COOLDOWN_MS = 60_000;
export const REFRESH_THROTTLE_MS = 30_000;
export const DISMISS_KEY = 'tv:verify-banner-dismissed';

function readDismissed(): boolean {
  try {
    return window.sessionStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * The session cookie froze `email_verified` at sign-in, so ask Firebase again: when the banner appears and whenever the
 * person comes back to this tab (they usually confirm in the mail app or another tab), at most once per 30 s.
 */
function useFreshVerification() {
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

function Banner({ onDismiss }: { onDismiss: () => void }) {
  const { sendVerification } = useAuth();
  useFreshVerification();
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

  const resend = async () => {
    if (cooling) return;
    setCooling(true);
    setMessage(null);
    let cool = true;
    try {
      await sendVerification();
      if (mounted.current) setMessage('E-mail enviado.');
    } catch (error) {
      // Only "too many requests" earns the wait; anything else (offline, say) can be retried straight away.
      cool = authErrorCode(error) === 'auth/too-many-requests';
      if (mounted.current) setMessage(authErrorMessage(error));
    }
    if (!mounted.current) return;
    if (cool) timer.current = setTimeout(() => setCooling(false), RESEND_COOLDOWN_MS);
    else setCooling(false);
  };

  return (
    <section
      aria-label="Confirmação de e-mail"
      className="pointer-events-none fixed inset-x-0 top-16 z-40 px-4 sm:px-6"
    >
      <div className="pointer-events-auto mx-auto flex max-w-xl items-start gap-3 rounded-2xl border border-ink-600 bg-ink-800/95 py-3 pr-2 pl-4 shadow-lg shadow-ink-950/60 backdrop-blur">
        <div className="min-w-0 flex-1">
          <p className="font-sans text-sm text-ivory">{VERIFY_TEXT}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3">
            <button
              type="button"
              aria-disabled={cooling}
              onClick={resend}
              className="-ml-2 inline-flex min-h-11 items-center rounded-full px-2 font-sans text-sm font-medium text-amber underline underline-offset-4 hover:text-amber-strong aria-disabled:cursor-default aria-disabled:text-ivory-muted aria-disabled:no-underline"
            >
              Reenviar e-mail
            </button>
            <span role="status" className="font-sans text-sm text-ivory-muted">
              {message}
            </span>
          </div>
        </div>
        <button
          type="button"
          aria-label="Fechar aviso"
          onClick={onDismiss}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ivory-muted hover:text-ivory"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>
    </section>
  );
}

/**
 * A toast-like card pinned just under the header. Fixed, so it never pushes the page or the full-bleed heroes (no
 * layout shift) and, being absent until sign-in resolves on the client, it cannot differ between server and client.
 */
export function VerifyEmailBanner() {
  const { status, user } = useAuth();
  const [dismissed, setDismissed] = useState(readDismissed);
  if (status !== 'signed-in' || user?.emailVerified !== false || dismissed) return null;
  const dismiss = () => {
    try {
      window.sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Private mode: the notice only comes back on the next page load.
    }
    setDismissed(true);
  };
  return <Banner onDismiss={dismiss} />;
}
