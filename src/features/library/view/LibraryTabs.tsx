'use client';

import type { KeyboardEvent } from 'react';
import { cn } from '@/lib/cn';
import { TABS, type LibraryTab } from './library-query';

const LABELS: Record<LibraryTab, string> = {
  assistindo: 'Assistindo',
  'quero-ver': 'Quero ver',
  assistidos: 'Assistidos',
};

export const tabId = (t: LibraryTab) => `lib-tab-${t}`;
export const panelId = (t: LibraryTab) => `lib-panel-${t}`;

export function LibraryTabs({
  active,
  counts,
  onChange,
}: {
  active: LibraryTab;
  counts: Record<LibraryTab, number>;
  onChange: (tab: LibraryTab) => void;
}) {
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = TABS.indexOf(active);
    const next =
      e.key === 'ArrowRight' ? TABS[(i + 1) % TABS.length]
      : e.key === 'ArrowLeft' ? TABS[(i + TABS.length - 1) % TABS.length]
      : e.key === 'Home' ? TABS[0]
      : e.key === 'End' ? TABS[TABS.length - 1]
      : null;
    if (!next) return;
    e.preventDefault();
    onChange(next);
    document.getElementById(tabId(next))?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label="Sua lista"
      onKeyDown={onKeyDown}
      className="flex gap-6 overflow-x-auto border-b border-ink-600"
    >
      {TABS.map((tab) => {
        const on = tab === active;
        return (
          <button
            key={tab}
            id={tabId(tab)}
            type="button"
            role="tab"
            aria-selected={on}
            aria-controls={panelId(tab)}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(tab)}
            className={cn(
              '-mb-px h-12 shrink-0 border-b-2 font-sans text-base font-medium whitespace-nowrap transition-colors motion-reduce:transition-none',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber',
              on ? 'border-amber text-ivory' : 'border-transparent text-ivory-muted hover:text-ivory',
            )}
          >
            {LABELS[tab]} · {counts[tab]}
          </button>
        );
      })}
    </div>
  );
}
