'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { OPEN_PALETTE_EVENT } from './open-palette';
import { isOpenShortcut, isSlashShortcut } from './shortcuts';

// The palette (combobox, query hooks, result list) is only downloaded the first time someone opens it.
const SearchPalette = dynamic(() => import('./SearchPalette').then((m) => m.SearchPalette), { ssr: false });

/** Tiny eager listener for Ctrl/Cmd+K, "/" and the header trigger; mounts the lazy palette on first use. */
export function SearchPaletteLauncher() {
  const [first, setFirst] = useState<{ opener: HTMLElement | null } | null>(null);

  useEffect(() => {
    if (first) return; // the loaded palette owns the shortcuts from now on
    const load = (opener: HTMLElement | null) => setFirst({ opener });
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || !(isOpenShortcut(e) || isSlashShortcut(e))) return;
      e.preventDefault();
      load(document.activeElement instanceof HTMLElement ? document.activeElement : null);
    };
    const onOpen = (e: Event) => load(e instanceof CustomEvent ? (e.detail as HTMLElement | null) : null);
    window.addEventListener('keydown', onKey);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpen);
    };
  }, [first]);

  return first ? <SearchPalette defaultOpen initialOpener={first.opener} /> : null;
}
