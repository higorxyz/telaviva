'use client';

import type { KeyboardEvent } from 'react';
import { cn } from '@/lib/cn';
import type { Mode } from './EmailForm';

const MODES: readonly { key: Mode; label: string }[] = [
  { key: 'entrar', label: 'Entrar' },
  { key: 'criar', label: 'Criar conta' },
];

export const tabId = (mode: Mode) => `entrar-aba-${mode}`;
export const PANEL_ID = 'entrar-painel';

/** "Entrar" / "Criar conta", ARIA tabs with roving focus (arrows wrap, Home and End jump). */
export function ModeTabs({ active, onChange }: { active: Mode; onChange(mode: Mode): void }) {
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const i = MODES.findIndex((m) => m.key === active);
    const last = MODES.length - 1;
    const next =
      event.key === 'ArrowRight' ? (i + 1) % MODES.length
      : event.key === 'ArrowLeft' ? (i + last) % MODES.length
      : event.key === 'Home' ? 0
      : event.key === 'End' ? last
      : null;
    if (next === null) return;
    event.preventDefault();
    const mode = MODES[next].key;
    onChange(mode);
    document.getElementById(tabId(mode))?.focus();
  }

  return (
    <div role="tablist" aria-label="Como entrar" onKeyDown={onKeyDown} className="grid grid-cols-2 border-b border-ink-600">
      {MODES.map(({ key, label }) => {
        const on = key === active;
        return (
          <button
            key={key}
            id={tabId(key)}
            type="button"
            role="tab"
            aria-selected={on}
            aria-controls={PANEL_ID}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(key)}
            className={cn(
              '-mb-px h-12 rounded-t-md border-b-2 font-sans text-base font-medium transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-amber motion-reduce:transition-none',
              on ? 'border-amber text-ivory' : 'border-transparent text-ivory-muted hover:text-ivory',
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
