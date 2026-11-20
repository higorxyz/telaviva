'use client';

import { ArrowLeft, MailCheck } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { looksLikeEmail } from '@/lib/email';
import { Button } from '@/ui/Button';
import { INVALID_EMAIL, OFFLINE, TOO_MANY_REQUESTS } from './errors';
import { Field, FormError, LINK_BUTTON } from './form-ui';
import { RESET_MESSAGE } from './reset-copy';

const SEND_FAILED = 'Não foi possível enviar agora. Tente de novo.';
const ERROR_ID = 'senha-erro';

type State =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent' }
  | { kind: 'error'; message: string; field: boolean };

/** In place of the sign-in form: asks for a reset link and always gives the same answer. */
export function ForgotPassword({ initialEmail, onBack }: { initialEmail: string; onBack(): void }) {
  const [email, setEmail] = useState(initialEmail);
  const [state, setState] = useState<State>({ kind: 'idle' });
  // One per submit: the error's key, so a repeated identical error is announced again.
  const [tries, setTries] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  // The form replaced the one that had focus: carry focus over to its field.
  useEffect(() => {
    input.current?.focus();
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (state.kind === 'sending') return;
    setTries((n) => n + 1);
    const address = email.trim();
    if (!looksLikeEmail(address)) return setState({ kind: 'error', message: INVALID_EMAIL, field: true });
    setState({ kind: 'sending' });
    try {
      const response = await fetch('/api/auth/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: address }),
      });
      if (response.ok) setState({ kind: 'sent' });
      else setState({ kind: 'error', message: response.status === 429 ? TOO_MANY_REQUESTS : SEND_FAILED, field: false });
    } catch {
      setState({ kind: 'error', message: OFFLINE, field: false });
    }
  }

  return (
    <div>
      <button type="button" onClick={onBack} className={`${LINK_BUTTON} -ml-0.5 no-underline`}>
        <ArrowLeft aria-hidden="true" className="size-4" />
        Voltar
      </button>
      <form noValidate onSubmit={submit} aria-labelledby="senha-titulo" className="mt-4 flex flex-col gap-3">
        <div>
          <h2 id="senha-titulo" className="font-display text-3xl text-ivory">
            Esqueci minha senha
          </h2>
          <p className="mt-2 font-sans text-base text-ivory-muted">
            Informe o e-mail da conta para receber um link de nova senha.
          </p>
        </div>
        <Field
          id="senha-email"
          label="E-mail"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          inputRef={input}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          invalid={state.kind === 'error' && state.field}
          errorId={ERROR_ID}
        />
        {state.kind === 'error' ? (
          <div className="mt-1">
            <FormError key={tries} id={ERROR_ID} message={state.message} />
          </div>
        ) : null}
        {/* Always rendered (Safari drops live regions that are display: none or contents), so the message is
            announced; while empty it has no height and cancels the gap above it. */}
        <div role="status" className="empty:-mt-3">
          {state.kind === 'sent' ? (
            <p className="flex gap-2.5 font-sans text-sm text-ivory">
              <MailCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-amber" />
              {RESET_MESSAGE}
            </p>
          ) : null}
        </div>
        <Button
          type="submit"
          variant="primary"
          aria-disabled={state.kind === 'sending' || undefined}
          className="mt-3 h-12 w-full"
        >
          {state.kind === 'sending' ? 'Enviando…' : 'Enviar link'}
        </Button>
      </form>
    </div>
  );
}
