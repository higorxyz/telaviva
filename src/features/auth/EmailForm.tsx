'use client';

import { useState, type FormEvent, type Ref } from 'react';
import { cn } from '@/lib/cn';
import { looksLikeEmail } from '@/lib/email';
import { Button } from '@/ui/Button';
import { INVALID_EMAIL, WEAK_PASSWORD, WRONG_CREDENTIALS } from './errors';
import { Field, FormError, LINK_BUTTON, PasswordField } from './form-ui';
import { useAuth } from './useAuth';

export type Mode = 'entrar' | 'criar';
export type Busy = 'google' | 'email' | null;

export const GOOGLE_HINT = "Se você criou a conta com o Google, use 'Continuar com Google'.";
const MISSING_PASSWORD = 'Digite sua senha.';
const MIN_PASSWORD = 8;
const ERROR_ID = 'entrar-erro';

const SUBMIT: Record<Mode, { idle: string; pending: string }> = {
  entrar: { idle: 'Entrar', pending: 'Entrando…' },
  criar: { idle: 'Criar conta', pending: 'Criando conta…' },
};

type FormErrorState = { mode: Mode; message: string; field: 'email' | 'password' | null };

type Props = {
  mode: Mode;
  busy: Busy;
  initialEmail: string;
  /** Runs a sign-in action; resolves with the message to show, or null (success, or nothing to say). */
  onAttempt(kind: 'email', action: () => Promise<void>): Promise<string | null>;
  onForgot(email: string): void;
  forgotRef: Ref<HTMLButtonElement>;
};

/** E-mail sign-in or sign-up (one form, two modes): checks the obvious mistakes before Firebase is asked. */
export function EmailForm({ mode, busy, initialEmail, onAttempt, onForgot, forgotRef }: Props) {
  const auth = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  // Kept with its mode: switching tabs hides it without an effect.
  const [error, setError] = useState<FormErrorState | null>(null);
  const shown = error?.mode === mode ? error : null;
  // One per submit: the error's key, so a repeated identical error is announced again.
  const [attempts, setAttempts] = useState(0);

  function invalid(message: string, field: FormErrorState['field']) {
    setError({ mode, message, field });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setAttempts((n) => n + 1);
    const address = email.trim();
    if (!looksLikeEmail(address)) return invalid(INVALID_EMAIL, 'email');
    if (mode === 'criar' && password.length < MIN_PASSWORD) return invalid(WEAK_PASSWORD, 'password');
    if (!password) return invalid(MISSING_PASSWORD, 'password');
    setError(null);
    const message = await onAttempt('email', () =>
      mode === 'criar' ? auth.signUpWithEmail(name.trim(), address, password) : auth.signInWithEmail(address, password),
    );
    if (message) invalid(message, message === INVALID_EMAIL ? 'email' : null);
  }

  const submitLabel = SUBMIT[mode];
  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-3">
      {mode === 'criar' ? (
        <Field
          id="entrar-nome"
          label={
            <>
              Nome <span className="font-normal text-ivory-muted">(opcional)</span>
            </>
          }
          type="text"
          autoComplete="name"
          autoCapitalize="words"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      ) : null}
      <Field
        id="entrar-email"
        label="E-mail"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        invalid={shown?.field === 'email'}
        errorId={ERROR_ID}
      />
      <PasswordField
        id="entrar-senha"
        label="Senha"
        autoComplete={mode === 'criar' ? 'new-password' : 'current-password'}
        required
        minLength={mode === 'criar' ? MIN_PASSWORD : undefined}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        invalid={shown?.field === 'password'}
        errorId={ERROR_ID}
        aside={
          mode === 'entrar' ? (
            // Text on the label's baseline, the 44 px target reaching up above it.
            <button
              ref={forgotRef}
              type="button"
              onClick={() => onForgot(email.trim())}
              className={cn(LINK_BUTTON, 'items-end pb-1')}
            >
              Esqueci minha senha
            </button>
          ) : null
        }
      />
      {shown ? (
        <div className="mt-1">
          <FormError
            key={attempts}
            id={ERROR_ID}
            message={shown.message}
            hint={shown.message === WRONG_CREDENTIALS ? GOOGLE_HINT : null}
          />
        </div>
      ) : null}
      <Button type="submit" variant="primary" aria-disabled={busy !== null || undefined} className="mt-3 h-12 w-full">
        {busy === 'email' ? submitLabel.pending : submitLabel.idle}
      </Button>
    </form>
  );
}
