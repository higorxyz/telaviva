'use client';

import { useEffect, useRef, useState } from 'react';
import { OPEN_PALETTE_EVENT } from './open-palette';
import { PaletteBody } from './PaletteBody';

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/** Search palette: native modal <dialog> (top layer, focus trapped), opened by Ctrl/Cmd+K, "/" or the header trigger. */
export function SearchPalette() {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const show = (e?: Event) => {
      if (dialog.current?.open) return;
      const from = e instanceof CustomEvent ? (e.detail as HTMLElement | null) : null;
      opener.current = from ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
      setOpen(true);
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (e.repeat) return;
        if (dialog.current?.open) setOpen(false);
        else show();
      } else if (e.key === '/' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey && !isEditable(e.target)) {
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

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      el.querySelector<HTMLInputElement>('input[role="combobox"]')?.focus();
    }
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      aria-label="Buscar"
      onClose={() => {
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
