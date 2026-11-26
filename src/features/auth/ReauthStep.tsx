'use client';

import { useEffect, useId, useRef, type FormEvent } from 'react';
import { cn } from '@/lib/cn';
import { buttonClasses } from '@/ui/Button';
import { REAUTH_TEXT } from './account-copy';
import { PasswordField } from './form-ui';
import { GoogleMark } from './GoogleMark';
import type { SessionUser } from './session-client';

type Props = {
  /** The provider of the session: what signing in again must use (the password form, or Google). */
  provider: SessionUser['provider'];
  /** The account's e-mail: the hidden username of the password form, so a password manager knows what to fill. */
  email: string | null;
  password: string;
  setPassword(password: string): void;
  busy: boolean;
  onSubmit(event?: FormEvent): void;
};

/**
 * The deletion dialog's "sign in again" step, shown when the server asks for a recent sign-in. Focus moves to its
 * control (the password field, or "Continuar com Google") as it appears.
 */
export function ReauthStep({ provider, email, password, setPassword, busy, onSubmit }: Props) {
  const control = useRef<HTMLButtonElement & HTMLInputElement>(null);
  const ids = { text: useId(), password: useId() };

  useEffect(() => {
    control.current?.focus();
  }, []);

  return (
    <div className="mt-6 border-t border-ink-700 pt-5">
      <p id={ids.text} className="font-sans text-sm text-ivory">
        {REAUTH_TEXT}
      </p>
      {provider === 'password' ? (
        <form onSubmit={onSubmit} className="mt-3 flex flex-col gap-3">
          {/* Never shown nor focusable: it tells password managers which account's password goes below. */}
          {email ? <input type="email" name="username" autoComplete="username" value={email} readOnly hidden /> : null}
          <PasswordField
            id={ids.password}
            label="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            aria-describedby={ids.text}
            inputRef={control}
          />
          <button
            type="submit"
            aria-disabled={busy || undefined}
            className={cn(buttonClasses({ variant: 'ghost' }), 'self-start')}
          >
            Entrar de novo
          </button>
        </form>
      ) : (
        <button
          ref={control}
          type="button"
          onClick={() => onSubmit()}
          aria-describedby={ids.text}
          aria-disabled={busy || undefined}
          className={cn(buttonClasses({ variant: 'ghost' }), 'mt-3 gap-3 bg-ink-950')}
        >
          <GoogleMark className="size-5" />
          Continuar com Google
        </button>
      )}
    </div>
  );
}
