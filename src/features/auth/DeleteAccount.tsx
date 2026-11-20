'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { buttonClasses } from '@/ui/Button';
import { clearLocalAccountData } from './account-client';
import { ACCOUNT_DELETED } from './account-copy';
import { DeleteDialogBody } from './DeleteDialogBody';
import { useAuth } from './useAuth';

/**
 * "Excluir minha conta" and its confirmation, a native modal `<dialog>`: focus moves into the field on open and back
 * to the button on close, Esc closes it, and nothing closes it while the deletion runs.
 *
 * After the deletion it clears what this device kept of the account, goes home, and becomes a visitor. "Conta
 * excluída." is queued by the sign-in state and shown only after the switch to the visitor is on screen, so the
 * library's identity switch (which closes the old identity's toasts) cannot take it.
 */
export function DeleteAccount({ onLeaving }: { onLeaving?: () => void }) {
  const auth = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  /** A new body per opening, so every confirmation starts empty. */
  const [opening, setOpening] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      el.querySelector('input')?.focus();
    }
    if (!open && el.open) el.close();
  }, [open]);

  async function finish() {
    const uid = auth.user?.id;
    onLeaving?.();
    if (uid) clearLocalAccountData(uid);
    router.replace('/');
    await auth.accountDeleted(ACCOUNT_DELETED);
  }

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="dialog"
        onClick={() => {
          setOpening((n) => n + 1);
          setOpen(true);
        }}
        className={cn(buttonClasses({ variant: 'ghost' }), 'border-wine hover:border-wine hover:bg-wine/40')}
      >
        Excluir minha conta
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        aria-busy={busy || undefined}
        onCancel={(event) => {
          if (busy) event.preventDefault();
        }}
        onClose={() => {
          setOpen(false);
          trigger.current?.focus();
        }}
        className="m-auto w-[min(calc(100%-2rem),30rem)] max-w-none rounded-2xl border border-wine bg-ink-900 p-0 text-ivory shadow-poster backdrop:bg-ink-950/85 open:animate-pop-in"
      >
        {open ? (
          <DeleteDialogBody
            key={opening}
            titleId={titleId}
            provider={auth.user?.provider ?? null}
            busy={busy}
            setBusy={setBusy}
            onCancel={() => {
              if (!busy) setOpen(false);
            }}
            onDeleted={finish}
          />
        ) : null}
      </dialog>
    </>
  );
}
