'use client';

import { Search } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { cn } from '@/lib/cn';
import { openSearchPalette } from './open-palette';

const noopSubscribe = () => () => {};
const clientHint = () => (/mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent) ? '⌘ K' : 'Ctrl K');

export function SearchTrigger({ className }: { className?: string }) {
  // Server and hydration render "Ctrl K"; macOS switches to "⌘ K" right after hydration (no mismatch).
  const hint = useSyncExternalStore(noopSubscribe, clientHint, () => 'Ctrl K');

  return (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={(e) => openSearchPalette(e.currentTarget)}
      className={cn(
        'items-center gap-2 rounded-full border border-ink-600 bg-ink-800/60 px-4 py-2 text-sm text-ivory-muted transition-colors hover:text-ivory focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber motion-reduce:transition-none',
        className,
      )}
    >
      <Search aria-hidden="true" className="size-4" />
      Buscar
      <kbd className="rounded border border-ink-600 px-1.5 text-xs text-ivory-muted">{hint}</kbd>
    </button>
  );
}
