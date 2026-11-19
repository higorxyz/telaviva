'use client';

import { createContext, useContext } from 'react';

export interface ToastInput {
  message: string;
  action?: { label: string; onClick: () => void };
  tone?: 'neutral' | 'error';
}

export interface ToastApi {
  show(toast: ToastInput): void;
}

export const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast must be used inside ToastProvider');
  return api;
}
