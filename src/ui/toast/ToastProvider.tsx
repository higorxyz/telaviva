'use client';

import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { Toaster, type ToastEntry } from './Toaster';
import { ToastContext, type ToastApi, type ToastInput } from './useToast';

const MAX_VISIBLE = 3;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const nextId = useRef(0);

  const show = useCallback((toast: ToastInput) => {
    const entry: ToastEntry = { ...toast, id: nextId.current++ };
    setToasts((current) => [...current, entry].slice(-MAX_VISIBLE));
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const dismissAll = useCallback(() => setToasts([]), []);

  const api = useMemo<ToastApi>(() => ({ show, dismissAll }), [show, dismissAll]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}
