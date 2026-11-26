'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { buttonClasses } from '@/ui/Button';
import { clearLocalAccountData } from './account-client';
import { useToast } from '@/ui/toast/useToast';
import { ACCOUNT_DELETED, STALE_ACCOUNT } from './account-copy';
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
  const toast = useToast();
  const [open, setOpen] = useState(false);
  /** The account the dialog was opened for: the one the page showed, the only one it may delete. */
  const [target, setTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** A new body per opening, so every confirmation starts empty. */
  const [opening, setOpening] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const textId = useId();

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      el.querySelector('input')?.focus();
    }
    if (!open && el.open) el.close();
  }, [open]);

  // Leaving /conta (browser Back included) hides it in a React <Activity> instead of unmounting it. A modal <dialog>
  // left open there would keep the rest of the app inert: close it right away, and come back with it closed.
  useLayoutEffect(() => {
    const el = dialog.current;
    return () => {
      if (el?.open) el.close();
      setOpen(false);
    };
  }, []);

  async function finish() {
    onLeaving?.();
    clearLocalAccountData(target);
    router.replace('/');
    await auth.accountDeleted(ACCOUNT_DELETED);
  }

  /** Another tab switched accounts: say so where it survives the identity switch, and show who is signed in now. */
  function stale() {
    toast.show({ message: STALE_ACCOUNT, tone: 'error' });
    void auth.refresh();
  }

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="dialog"
        onClick={() => {
          setTarget(auth.user?.id ?? null);
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
        aria-describedby={textId}
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
        {open && target ? (
          <DeleteDialogBody
            key={opening}
            titleId={titleId}
            textId={textId}
            expectedUid={target}
            onStale={stale}
            provider={auth.user?.provider ?? null}
            email={auth.user?.email ?? null}
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
