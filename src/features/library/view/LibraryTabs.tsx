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
    // The baseline sits on a wrapper, not on the scroller: tabs painting over the scroller's own border would
    // overflow it by 1px and give it a vertical scrollbar. The scroller's side padding (cancelled by negative
    // margins) leaves room for the focus ring of the first and last tabs.
    <div className="border-b border-ink-600">
      <div
        role="tablist"
        aria-label="Sua lista"
        onKeyDown={onKeyDown}
        className="-mx-2 -mb-px flex gap-6 overflow-x-auto overflow-y-hidden px-2"
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
                'group h-12 shrink-0 border-b-2 font-sans text-base font-medium whitespace-nowrap transition-colors focus-visible:outline-none motion-reduce:transition-none',
                on ? 'border-amber text-ivory' : 'border-transparent text-ivory-muted hover:text-ivory',
              )}
            >
              {/* The ring hugs the label, inside the scroller, so nothing clips it. */}
              <span className="-mx-1.5 rounded-sm px-1.5 py-1 group-focus-visible:outline-2 group-focus-visible:outline-amber">
                {LABELS[tab]} · {counts[tab]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
