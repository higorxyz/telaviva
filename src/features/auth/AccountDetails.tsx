'use client';

import { CircleAlert, CircleCheck } from 'lucide-react';
import { PROVIDER_LABEL } from './account-copy';
import { RESEND_LABEL, useResendVerification } from './resend-verification';
import type { SessionUser } from './session-client';

/** "Reenviar e-mail" beside "E-mail não confirmado": the same action as the banner, where people look for it. */
function Resend() {
  const { resend, cooling, message } = useResendVerification();
  return (
    <span className="flex flex-wrap items-center gap-x-3">
      <button
        type="button"
        aria-disabled={cooling}
        onClick={resend}
        className="-ml-2 inline-flex min-h-11 items-center rounded-xl px-2 font-medium text-amber underline underline-offset-4 hover:text-amber-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber aria-disabled:cursor-default aria-disabled:text-ivory-muted aria-disabled:no-underline"
      >
        {RESEND_LABEL}
      </button>
      <span role="status" className="text-ivory-muted">
        {message}
      </span>
    </span>
  );
}

/** How the person signs in, and whether their e-mail is confirmed (with the resend when it is not). */
export function AccountDetails({ user, className }: { user: SessionUser; className?: string }) {
  return (
    <dl className={`grid grid-cols-[auto_1fr] items-baseline gap-x-8 gap-y-3 font-sans text-sm ${className ?? ''}`}>
      {user.provider ? (
        <>
          <dt className="text-ivory-muted">Acesso</dt>
          <dd className="text-ivory">{PROVIDER_LABEL[user.provider]}</dd>
        </>
      ) : null}
      <dt className="text-ivory-muted">Verificação</dt>
      <dd>
        {user.emailVerified ? (
          <span className="inline-flex items-center gap-1.5 text-ivory">
            <CircleCheck aria-hidden="true" className="size-4 text-ivory-muted" />
            E-mail confirmado
          </span>
        ) : (
          <span className="flex flex-wrap items-center gap-x-5">
            <span className="inline-flex items-center gap-1.5 text-ivory">
              <CircleAlert aria-hidden="true" className="size-4 text-amber" />
              E-mail não confirmado
            </span>
            <Resend />
          </span>
        )}
      </dd>
    </dl>
  );
}
