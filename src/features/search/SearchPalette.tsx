'use client';

import { useEffect, useRef, useState } from 'react';
import { OPEN_PALETTE_EVENT } from './open-palette';
import { PaletteBody } from './PaletteBody';

import { isOpenShortcut, isSlashShortcut } from './shortcuts';

/**
 * Search palette: native modal <dialog> (top layer, focus trapped), opened by Ctrl/Cmd+K, "/" or the header trigger.
 * `defaultOpen`/`initialOpener` let the lazy launcher hand over the keystroke that loaded it.
 */
export function SearchPalette({
  defaultOpen = false,
  initialOpener = null,
}: {
  defaultOpen?: boolean;
  initialOpener?: HTMLElement | null;
} = {}) {
  const [open, setOpen] = useState(defaultOpen);
  /** Counts the openings: see the effect that shows the dialog. */
  const [opening, setOpening] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(initialOpener);

  useEffect(() => {
    const show = (e?: Event) => {
      if (dialog.current?.open) return;
      const from = e instanceof CustomEvent ? (e.detail as HTMLElement | null) : null;
      opener.current = from ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
      setOpen(true);
      setOpening((n) => n + 1);
    };
    const onKey = (e: KeyboardEvent) => {
      if (isOpenShortcut(e)) {
        e.preventDefault();
        if (e.repeat) return;
        if (dialog.current?.open) setOpen(false);
        else show();
      } else if (isSlashShortcut(e)) {
        if (dialog.current?.open) return;
        e.preventDefault();
        show();
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener(OPEN_PALETTE_EVENT, show);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(OPEN_PALETTE_EVENT, show);
    };
  }, []);

  // Esc closes the element at once, but its `close` event (which sets `open` back to false) is a queued task: on a
  // busy main thread the next shortcut can come first, while `open` is still true. Each opening counts (`opening`),
  // so that shortcut still shows the dialog, and the late `close` finds it open again and is ignored.
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      el.querySelector<HTMLInputElement>('input[role="combobox"]')?.focus();
    }
    if (!open && el.open) el.close();
  }, [open, opening]);

  return (
    <dialog
      ref={dialog}
      aria-label="Buscar"
      onClose={() => {
        if (dialog.current?.open) return; // An earlier closing's late event: it was opened again meanwhile.
        setOpen(false);
        opener.current?.focus();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
      className="mx-auto mt-[12dvh] w-[min(94vw,40rem)] max-w-none overflow-hidden rounded-2xl border border-ink-600 bg-ink-900 p-0 text-ivory shadow-poster backdrop:bg-ink-950/80 backdrop:backdrop-blur-sm"
    >
      {open ? <PaletteBody onNavigate={() => setOpen(false)} /> : null}
    </dialog>
  );
}
