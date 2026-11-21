'use client';

import { createContext, useContext } from 'react';

export interface ToastInput {
  message: string;
  action?: { label: string; onClick: () => void };
  tone?: 'neutral' | 'error';
  /** Groups toasts that `dismissTag` can close together, such as the library's undo actions. */
  tag?: string;
}

export interface ToastApi {
  show(toast: ToastInput): void;
  /** Closes the toasts shown with this tag, such as undo actions that stop making sense when the identity changes. */
  dismissTag(tag: string): void;
}

export const ToastContext = createContext<ToastApi | null>(null);

/**
 * The lowest slot of the toast stack, for a notice that stays until dismissed (the e-mail confirmation): portal it
 * here and the toasts pile up above it, never on top of it. Null until the stack is on screen.
 */
export const ToastDockContext = createContext<HTMLElement | null>(null);

export function useToastDock(): HTMLElement | null {
  return useContext(ToastDockContext);
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast must be used inside ToastProvider');
  return api;
}
