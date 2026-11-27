'use client';

import { LogOut } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { useOptionalLibraryRepository } from '@/features/library/LibraryProvider';
import { buttonClasses } from '@/ui/Button';
import { SIGN_OUT_ANYWAY, unsentActions } from './account-copy';

/**
 * "Sair". With actions of this account still in the offline queue, it asks first (they are discarded with the
 * account's copy on this device), in a native modal `<dialog>`: focus goes to "Cancelar" on open and back to "Sair" on
 * close, Esc is "Cancelar", and the text labels the dialog. With nothing waiting it signs out at once.
 */
export function SignOutConfirm({ onSignOut }: { onSignOut(): Promise<void> | void }) {
  const queue = useOptionalLibraryRepository()?.queue;
  /** How many actions were waiting when the dialog opened; null while closed. */
  const [unsent, setUnsent] = useState<number | null>(null);
  /** Counts the openings: see the effect below. */
  const [opening, setOpening] = useState(0);
  const checking = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const textId = useId();
  const open = unsent !== null;

  // Esc closes the element at once, but its `close` event (which clears `unsent`) is a queued task: on a busy main
  // thread the next press of "Sair" can come first, while `unsent` is still set. Each opening counts (`opening`), so
  // that press still shows the dialog, and the late `close` finds it open again and is ignored.
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      cancel.current?.focus();
    }
    if (!open && el.open) el.close();
  }, [open, opening]);

  // Leaving /conta (browser Back included) hides it in a React <Activity> instead of unmounting it. A modal <dialog>
  // left open there would keep the rest of the app inert: close it right away, and come back with it closed.
  useLayoutEffect(() => {
    const el = dialog.current;
    return () => {
      if (el?.open) el.close();
      setUnsent(null);
    };
  }, []);

  async function start() {
    if (checking.current || dialog.current?.open) return;
    checking.current = true;
    try {
      const waiting = queue ? await queue.count().catch(() => 0) : 0;
      if (waiting > 0) {
        setUnsent(waiting);
        setOpening((n) => n + 1);
      } else void onSignOut();
    } finally {
      checking.current = false;
    }
  }

  function leaveAnyway() {
    setUnsent(null);
    void onSignOut();
  }

  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={() => void start()}
        className={buttonClasses({ variant: 'ghost', size: 'sm' })}
      >
        <LogOut aria-hidden="true" className="size-4" />
        Sair
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={textId}
        onClose={() => {
          if (dialog.current?.open) return; // An earlier closing's late event: it was opened again meanwhile.
          setUnsent(null);
          trigger.current?.focus();
        }}
        className="m-auto w-[min(calc(100%-2rem),28rem)] max-w-none rounded-2xl border border-ink-600 bg-ink-900 p-0 text-ivory shadow-poster backdrop:bg-ink-950/85 open:animate-pop-in"
      >
        {open ? (
          <div className="p-6 sm:p-7">
            <p id={textId} className="font-sans text-base text-ivory">
              {unsentActions(unsent)}
            </p>
            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                ref={cancel}
                type="button"
                onClick={() => setUnsent(null)}
                className={buttonClasses({ variant: 'quiet' })}
              >
                Cancelar
              </button>
              <button type="button" onClick={leaveAnyway} className={buttonClasses({ variant: 'primary' })}>
                <LogOut aria-hidden="true" className="size-4" />
                {SIGN_OUT_ANYWAY}
              </button>
            </div>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
