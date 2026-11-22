'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useIsOffline } from '@/features/offline/useIsOffline';
import { useEffect, useRef, useState } from 'react';
import { buttonClasses } from '@/ui/Button';
import { cn } from '@/lib/cn';
import { NEEDS_NETWORK } from '@/features/offline/copy';
import { EmailForm, type Busy, type Mode } from './EmailForm';
import { authErrorMessage } from './errors';
import { preloadFirebase } from './firebase-client';
import { ForgotPassword } from './ForgotPassword';
import { FormError } from './form-ui';
import { GoogleMark } from './GoogleMark';
import { ModeTabs, PANEL_ID, tabId } from './ModeTabs';
import { AFTER_SIGN_IN, ALREADY_SIGNED_IN, safeReturnTo } from './return-to';
import { redirectPending } from './sign-in';
import { useAuth } from './useAuth';

export const PRIVACY_NOTICE =
  'Guardamos seu nome, seu e-mail e sua lista. Você pode exportar ou excluir tudo em Sua conta.';

/**
 * Set when a sign-in starts on this screen, cleared when it fails. Becoming signed in switches the library to the
 * account, which unmounts the page and mounts a new one: that new instance reads this, so it knows the sign-in was made
 * here and sends the person where their own sign-in goes (`AFTER_SIGN_IN`), not where someone who arrived already
 * signed in goes. It is consumed by that instance, and also forgotten whenever the form is shown to a visitor.
 */
let signInStartedHere = false;

/**
 * The /entrar screen: Google, then e-mail with "Entrar" / "Criar conta" tabs, or the reset form in their place.
 * After its own sign-in it goes to `?voltar=` or the list; someone who arrives already signed in goes to `?voltar=`
 * or their account.
 */
export function SignInView() {
  const auth = useAuth();
  const router = useRouter();
  const offline = useIsOffline();
  const voltar = useSearchParams().get('voltar');
  const [mode, setMode] = useState<Mode>('entrar');
  const [view, setView] = useState<'form' | 'forgot'>('form');
  const [email, setEmail] = useState('');
  /** A sign-in started here is running (and stays set once it succeeded): its own handler picks the destination. */
  const [busy, setBusy] = useState<Busy>(null);
  const [googleError, setGoogleError] = useState<string | null>(null);
  /** One per Google click: the error's key, so a repeated identical error is announced again. */
  const [googleTries, setGoogleTries] = useState(0);
  /** Back from the Google redirect: this is a fresh sign-in, not someone already signed in. */
  const fresh = useRef(false);
  /** This instance replaced the one where the sign-in was started (see `signInStartedHere`). */
  const [inherited] = useState(() => signInStartedHere);
  const left = useRef(false);
  const backFromForgot = useRef(false);
  const forgotButton = useRef<HTMLButtonElement>(null);

  // Runs before AuthProvider's own start (child effects first), while the redirect flag is still there. Firebase
  // starts downloading now, so the popup can open within the click's user activation (Safari) instead of falling
  // back to the redirect.
  useEffect(() => {
    fresh.current = redirectPending();
    preloadFirebase();
  }, []);

  useEffect(() => {
    if (inherited || auth.status === 'guest') signInStartedHere = false;
  }, [inherited, auth.status]);

  const signedIn = auth.status === 'signed-in';
  const acting = busy !== null;
  useEffect(() => {
    if (!signedIn || acting || left.current) return;
    left.current = true;
    router.replace(safeReturnTo(voltar, fresh.current || inherited ? AFTER_SIGN_IN : ALREADY_SIGNED_IN));
  }, [signedIn, acting, voltar, router, inherited]);

  useEffect(() => {
    if (view !== 'form' || !backFromForgot.current) return;
    backFromForgot.current = false;
    forgotButton.current?.focus();
  }, [view]);

  async function attempt(kind: 'google' | 'email', action: () => Promise<void>): Promise<string | null> {
    // Firebase is not even asked: offline it could only fail, after a wait.
    if (offline) return NEEDS_NETWORK;
    setBusy(kind);
    signInStartedHere = true;
    try {
      await action();
    } catch (error) {
      signInStartedHere = false;
      setBusy(null);
      return authErrorMessage(error);
    }
    // Signed in: stay busy while the next page loads.
    left.current = true;
    router.replace(safeReturnTo(voltar, AFTER_SIGN_IN));
    return null;
  }

  async function google() {
    if (busy) return;
    setGoogleTries((n) => n + 1);
    setGoogleError(null);
    setGoogleError(await attempt('google', auth.signInWithGoogle));
  }

  if (signedIn && !acting) {
    return (
      <p role="status" className="mt-10 font-sans text-ivory-muted">
        Você já entrou. Abrindo…
      </p>
    );
  }

  return (
    <div className="mt-10">
      {view === 'forgot' ? (
        <ForgotPassword
          initialEmail={email}
          onBack={() => {
            backFromForgot.current = true;
            setMode('entrar');
            setView('form');
          }}
        />
      ) : (
        <>
          <button
            type="button"
            onClick={google}
            aria-disabled={busy !== null || undefined}
            className={cn(buttonClasses({ variant: 'ghost' }), 'h-12 w-full gap-3 bg-ink-900')}
          >
            <GoogleMark className="size-5" />
            {busy === 'google' ? 'Abrindo o Google…' : 'Continuar com Google'}
          </button>
          {googleError ? (
            <div className="mt-3">
              <FormError key={googleTries} message={googleError} />
            </div>
          ) : null}

          <div className="my-7 flex items-center gap-4 font-sans text-sm text-ivory-muted">
            <span aria-hidden="true" className="h-px flex-1 bg-ink-600" />
            ou com e-mail
            <span aria-hidden="true" className="h-px flex-1 bg-ink-600" />
          </div>

          <ModeTabs active={mode} onChange={setMode} />
          <div role="tabpanel" id={PANEL_ID} aria-labelledby={tabId(mode)} className="pt-5">
            <EmailForm
              mode={mode}
              busy={busy}
              initialEmail={email}
              onAttempt={attempt}
              forgotRef={forgotButton}
              onForgot={(typed) => {
                setEmail(typed);
                setView('forgot');
              }}
            />
          </div>
        </>
      )}
      <p className="mt-8 border-t border-ink-700 pt-5 font-sans text-sm text-ivory-muted">{PRIVACY_NOTICE}</p>
    </div>
  );
}
