'use client';

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { parseLibraryQuery, toLibrarySearch, type LibraryQuery } from './library-query';

/**
 * Tab, type and order mirrored in the URL. Written with history.replaceState (no RSC round trip, no history
 * entry); a URL that changes to something we did not write (back/forward) is adopted. The default tab
 * depends on the library, so the raw query string is kept and parsed on every render.
 */
export function useLibraryQuery(hasWatching: boolean): [LibraryQuery, (patch: Partial<LibraryQuery>) => void] {
  const urlSearch = useSearchParams().toString();
  const [raw, setRaw] = useState(urlSearch);
  const [urlSeen, setUrlSeen] = useState(urlSearch);
  if (urlSearch !== urlSeen) {
    setUrlSeen(urlSearch);
    setRaw(urlSearch);
  }

  const query = parseLibraryQuery(new URLSearchParams(raw), hasWatching);
  const update = (patch: Partial<LibraryQuery>) => {
    const search = toLibrarySearch({ ...query, ...patch }, hasWatching);
    setRaw(search);
    window.history.replaceState(null, '', search ? `/minha-lista?${search}` : '/minha-lista');
  };
  return [query, update];
}
