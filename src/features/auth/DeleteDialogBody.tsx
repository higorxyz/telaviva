'use client';

import { LoaderCircle } from 'lucide-react';
import { useIsOffline } from '@/features/offline/useIsOffline';
import { useId, useState, type FormEvent } from 'react';
import { cn } from '@/lib/cn';
import { NEEDS_NETWORK } from '@/features/offline/copy';
import { buttonClasses } from '@/ui/Button';
import { requestAccountDeletion } from './account-client';
import {
  CONFIRM_LABEL,
  CONFIRM_WORD,
  DELETE_ERROR,
  DELETE_FOREVER,
  DELETE_TEXT,
  PASSWORD_MISSING,
  STALE_ACCOUNT,
  WRONG_ACCOUNT,
} from './account-copy';
import type { ReauthOutcome } from './auth-flows';
import { authErrorCode, authErrorMessage, OFFLINE } from './errors';
import { Field, FormError } from './form-ui';
import { ReauthMismatchError } from './reauth';
import { ReauthStep } from './ReauthStep';
import type { SessionUser } from './session-client';
import { useAuth } from './useAuth';

type Props = {
  titleId: string;
  /** The irreversibility text, which describes the dialog. */
  textId: string;
  /** The uid the dialog was opened for, sent with the deletion. */
  expectedUid: string;
  /** The session turned out to be another account's (409): the parent tells the person and reloads who is in. */
  onStale(): void;
  provider: SessionUser['provider'];
  /** The account's e-mail, for the password managers on the "sign in again" step. */
  email: string | null;
  busy: boolean;
  setBusy(busy: boolean): void;
  onCancel(): void;
  onDeleted(): Promise<void>;
};

/** null: the person closed the popup themselves, nothing to say. */
function reauthError(error: unknown): string | null {
  if (error instanceof ReauthMismatchError || authErrorCode(error) === 'auth/user-mismatch') return WRONG_ACCOUNT;
  return authErrorMessage(error);
}

/**
 * The confirmation inside the dialog. "Excluir para sempre" works only with EXCLUIR typed exactly. When the server
 * asks for a recent sign-in, the person signs in again with the provider of their session (Google, or their
 * password), which mints a new session, and the deletion is tried once more.
 */
export function DeleteDialogBody(props: Props) {
  const { titleId, textId, expectedUid, onStale, provider, email, busy, setBusy, onCancel, onDeleted } = props;
  const { reauthenticate } = useAuth();
  const offline = useIsOffline();
  const [word, setWord] = useState('');
  const [phase, setPhase] = useState<'confirm' | 'reauth'>('confirm');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<{ message: string; key: number } | null>(null);
  const ids = { form: useId(), field: useId() };
  // Surrounding spaces are forgiven (phone keyboards often add one after a word), but the case must match.
  const ready = word.trim() === CONFIRM_WORD;

  function fail(message: string | null) {
    setBusy(false);
    setError(message ? { message, key: Date.now() } : null);
  }

  async function attempt(afterReauth: boolean) {
    const result = await requestAccountDeletion(expectedUid);
    if (result === 'deleted') return onDeleted(); // Stays busy while the page leaves.
    if (result === 'reauth' && !afterReauth) {
      setPhase('reauth');
      return fail(null);
    }
    if (result === 'wrong_account') {
      fail(STALE_ACCOUNT);
      return onStale();
    }
    fail(result === 'offline' ? OFFLINE : DELETE_ERROR);
  }

  function confirm(event: FormEvent) {
    event.preventDefault();
    if (!ready || busy || phase !== 'confirm') return;
    if (offline) return fail(NEEDS_NETWORK);
    setBusy(true);
    setError(null);
    void attempt(false);
  }

  async function signInAgain(event?: FormEvent) {
    event?.preventDefault();
    if (busy) return;
    const usePassword = provider === 'password';
    if (usePassword && !password) return fail(PASSWORD_MISSING);
    if (offline) return fail(NEEDS_NETWORK);
    setBusy(true);
    setError(null);
    let outcome: ReauthOutcome;
    try {
      outcome = await reauthenticate(usePassword ? password : undefined);
    } catch (cause) {
      return fail(reauthError(cause));
    }
    if (outcome === 'leaving') return; // Off to the Google redirect: stays busy.
    if (outcome === 'aborted') return fail(STALE_ACCOUNT);
    // Back to the confirmation, so a failed retry (502, offline) can be tried again without signing in again.
    setPhase('confirm');
    await attempt(true);
  }

  return (
    <div className="p-6 sm:p-7">
      <h2 id={titleId} className="font-display text-3xl leading-tight text-ivory">
        Excluir minha conta
      </h2>
      <p id={textId} className="mt-3 font-sans text-base text-ivory">
        {DELETE_TEXT}
      </p>

      <form id={ids.form} onSubmit={confirm} className="mt-5">
        <Field
          id={ids.field}
          label={CONFIRM_LABEL}
          value={word}
          onChange={(e) => setWord(e.target.value)}
          readOnly={busy || phase !== 'confirm'}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          enterKeyHint="done"
        />
      </form>

      {phase === 'reauth' ? (
        <ReauthStep
          provider={provider}
          email={email}
          password={password}
          setPassword={setPassword}
          busy={busy}
          onSubmit={(event) => void signInAgain(event)}
        />
      ) : null}

      {error ? (
        <div className="mt-5">
          <FormError key={error.key} message={error.message} />
        </div>
      ) : null}

      <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          aria-disabled={busy || undefined}
          className={buttonClasses({ variant: 'quiet' })}
        >
          Cancelar
        </button>
        {phase === 'confirm' ? (
          <button
            type="submit"
            form={ids.form}
            aria-disabled={!ready || busy || undefined}
            className={cn(buttonClasses({ variant: 'primary' }), 'bg-wine text-ivory hover:bg-wine hover:brightness-125')}
          >
            {busy ? <LoaderCircle aria-hidden="true" className="size-4 motion-safe:animate-spin" /> : null}
            {DELETE_FOREVER}
          </button>
        ) : null}
      </div>
    </div>
  );
}
