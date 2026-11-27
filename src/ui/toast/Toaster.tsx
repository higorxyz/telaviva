'use client';

import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import type { ToastInput } from './useToast';

export interface ToastEntry extends ToastInput {
  id: number;
}

const LIFETIME_MS = 5000;
// The amber ring used across the app; the toast's 4px inner padding leaves room for it.
const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber';

function ToastItem({ toast, onDismiss }: { toast: ToastEntry; onDismiss: (id: number) => void }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const paused = hovered || focused;
  const remaining = useRef(LIFETIME_MS);
  const { id } = toast;

  useEffect(() => {
    if (paused) return;
    const startedAt = Date.now();
    const timer = setTimeout(() => onDismiss(id), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt));
    };
  }, [paused, id, onDismiss]);

  const error = toast.tone === 'error';

  return (
    <div
      data-toast=""
      data-tone={error ? 'error' : 'neutral'}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      className={cn(
        'pointer-events-auto flex w-full max-w-sm animate-toast-in items-center gap-1 rounded-2xl border py-1 pr-1 pl-4 text-sm shadow-poster',
        error ? 'border-wine bg-wine text-ivory' : 'border-ink-600 bg-ink-800 text-ivory',
      )}
    >
      <p className="min-w-0 flex-1 py-2 text-pretty">{toast.message}</p>
      {toast.action ? (
        <button
          type="button"
          onClick={() => {
            toast.action?.onClick();
            onDismiss(id);
          }}
          className={cn('min-h-11 shrink-0 rounded-xl px-3 font-medium text-amber hover:text-amber-strong', FOCUS)}
        >
          {toast.action.label}
        </button>
      ) : null}
      <button
        type="button"
        aria-label="Fechar aviso"
        onClick={() => onDismiss(id)}
        className={cn(
          'flex size-11 shrink-0 items-center justify-center rounded-xl text-ivory-muted hover:text-ivory',
          FOCUS,
        )}
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}

type ToasterProps = {
  toasts: ToastEntry[];
  onDismiss: (id: number) => void;
  /** Receives the slot for a notice that stays (see `useToastDock`). */
  dockRef?: (element: HTMLElement | null) => void;
  /** Receives the slot under it, for a status with its own live region (see `useToastStatusSlot`). */
  statusSlotRef?: (element: HTMLElement | null) => void;
};

/**
 * Sits above the mobile TabBar (h-14 + safe area) and in the bottom corner on desktop. One fixed column: the toasts
 * (a polite live region), under them the dock for a notice that stays, and at the very bottom the status slot (the
 * connection indicator, closest to the edge). Fixed, so nothing in the page moves.
 */
export function Toaster({ toasts, onDismiss, dockRef, statusSlotRef }: ToasterProps) {
  const column = 'flex w-full flex-col items-center gap-2 md:items-end';
  return (
    <div
      data-toast-stack=""
      className="pointer-events-none fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-60 flex flex-col items-center gap-2 px-4 md:inset-x-auto md:right-6 md:bottom-6 md:items-end md:px-0"
    >
      {/* Never hidden, even empty: a live region must already be in the tree when a message arrives. */}
      <div role="status" aria-live="polite" className={column}>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </div>
      <div ref={dockRef} className={cn(column, 'empty:hidden')} />
      {/* Never hidden while it holds the status's region (a live region must stay in the tree); while that region is
          empty it has no height, and the negative margin cancels the gap above it. */}
      <div ref={statusSlotRef} className={cn(column, 'empty:hidden has-[>:empty]:-mt-2')} />
    </div>
  );
}
