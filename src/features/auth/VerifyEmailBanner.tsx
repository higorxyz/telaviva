'use client';

import { MailWarning, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
import { useToastDock } from '@/ui/toast/useToast';
import { RESEND_LABEL, useResendVerification } from './resend-verification';
import { useAuth } from './useAuth';

export const VERIFY_TEXT = 'Confirme seu e-mail para proteger sua conta.';
export const REFRESH_THROTTLE_MS = 30_000;
export const DISMISS_KEY = 'tv:verify-banner-dismissed';

// The amber ring used across the app, as on the toasts beside it.
const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber';

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
  useFreshVerification();
  const { resend, cooling, message } = useResendVerification();

  return (
    <section
      aria-label="Confirmação de e-mail"
      className="pointer-events-auto flex w-full max-w-sm animate-toast-in items-start gap-3 rounded-2xl border border-ink-600 bg-ink-800 py-1 pr-1 pl-4 text-sm text-ivory shadow-poster"
    >
      <MailWarning aria-hidden="true" className="mt-3 size-4 shrink-0 text-amber" />
      <div className="min-w-0 flex-1 py-2">
        <p className="text-pretty">{VERIFY_TEXT}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3">
          <button
            type="button"
            aria-disabled={cooling}
            onClick={resend}
            className={cn(
              '-ml-2 inline-flex min-h-11 items-center rounded-xl px-2 font-medium text-amber underline underline-offset-4 hover:text-amber-strong aria-disabled:cursor-default aria-disabled:text-ivory-muted aria-disabled:no-underline',
              FOCUS,
            )}
          >
            {RESEND_LABEL}
          </button>
          <span role="status" className="text-ivory-muted">
            {message}
          </span>
        </div>
      </div>
      <button
        type="button"
        aria-label="Fechar aviso"
        onClick={onDismiss}
        className={cn(
          'flex size-11 shrink-0 items-center justify-center rounded-xl text-ivory-muted hover:text-ivory',
          FOCUS,
        )}
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </section>
  );
}

/**
 * A card in the lowest slot of the toast stack (`useToastDock`): above the TabBar on phones, in the bottom corner on
 * desktop, with the toasts piling up above it. It is fixed, so it never pushes the page (no layout shift) nor covers a
 * title, and, being absent until sign-in resolves on the client, it cannot differ between server and client. Closing
 * it hides it for the rest of the browser session; /conta keeps the same "Reenviar e-mail" in place.
 */
export function VerifyEmailBanner() {
  const { status, user } = useAuth();
  const dock = useToastDock();
  const [dismissed, setDismissed] = useState(readDismissed);
  if (status !== 'signed-in' || user?.emailVerified !== false || dismissed || !dock) return null;
  const dismiss = () => {
    try {
      window.sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Private mode: the notice only comes back on the next page load.
    }
    setDismissed(true);
  };
  return createPortal(<Banner onDismiss={dismiss} />, dock);
}
