'use client';

import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { Toaster, type ToastEntry } from './Toaster';
import {
  ToastContext,
  ToastDockContext,
  ToastStatusSlotContext,
  type ToastApi,
  type ToastInput,
} from './useToast';

const MAX_VISIBLE = 3;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const [dock, setDock] = useState<HTMLElement | null>(null);
  const [statusSlot, setStatusSlot] = useState<HTMLElement | null>(null);
  const nextId = useRef(0);

  const show = useCallback((toast: ToastInput) => {
    const entry: ToastEntry = { ...toast, id: nextId.current++ };
    setToasts((current) => [...current, entry].slice(-MAX_VISIBLE));
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const dismissTag = useCallback((tag: string) => {
    setToasts((current) => current.filter((t) => t.tag !== tag));
  }, []);

  const api = useMemo<ToastApi>(() => ({ show, dismissTag }), [show, dismissTag]);

  return (
    <ToastContext.Provider value={api}>
      <ToastDockContext.Provider value={dock}>
        <ToastStatusSlotContext.Provider value={statusSlot}>
          {children}
          <Toaster toasts={toasts} onDismiss={dismiss} dockRef={setDock} statusSlotRef={setStatusSlot} />
        </ToastStatusSlotContext.Provider>
      </ToastDockContext.Provider>
    </ToastContext.Provider>
  );
}
