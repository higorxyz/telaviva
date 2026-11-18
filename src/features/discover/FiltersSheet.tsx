'use client';

import { SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/ui/Button';

/**
 * Mobile filters: a bottom sheet on a native modal <dialog> (focus trapped, Esc closes). The trigger is hidden
 * from md up, and the sheet closes itself if the viewport becomes wide (rotation), since the sidebar takes over.
 * `onDismiss` runs whenever the sheet closes, so unapplied edits are discarded.
 */
export function FiltersSheet({
  count,
  onDismiss,
  children,
}: {
  count: number;
  onDismiss: () => void;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  useEffect(() => {
    if (!open || !window.matchMedia) return;
    const wide = window.matchMedia('(min-width: 48rem)');
    const onChange = () => {
      if (wide.matches) setOpen(false);
    };
    wide.addEventListener('change', onChange);
    return () => wide.removeEventListener('change', onChange);
  }, [open]);

  return (
    <>
      <Button variant="ghost" size="sm" className="md:hidden" onClick={() => setOpen(true)}>
        <SlidersHorizontal aria-hidden="true" className="size-4" />
        Filtros ({count})
      </Button>
      <dialog
        ref={dialog}
        aria-label="Filtros"
        onClose={() => {
          setOpen(false);
          onDismiss();
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpen(false);
        }}
        className="mx-0 mt-auto mb-0 max-h-[88dvh] w-full max-w-none overflow-y-auto rounded-t-2xl border-t border-ink-600 bg-ink-900 p-0 text-ivory backdrop:bg-ink-950/80"
      >
        <div className="p-5 pb-0">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-display text-2xl">Filtros</h2>
            <button
              type="button"
              aria-label="Fechar filtros"
              onClick={() => setOpen(false)}
              className="grid size-10 place-items-center rounded-full text-ivory-muted hover:text-ivory focus-visible:outline-2 focus-visible:outline-amber"
            >
              <X aria-hidden="true" className="size-5" />
            </button>
          </div>
          {open ? children(() => setOpen(false)) : null}
        </div>
      </dialog>
    </>
  );
}
