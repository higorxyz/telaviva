'use client';

import { usePathname } from 'next/navigation';
import { useIsOffline } from './useIsOffline';
import { useEffect, useState } from 'react';
import { PENDING_NAVIGATION_DELAY_MS } from './copy';

const here = () => window.location.pathname + window.location.search;

/**
 * Where a click sends the router: a same-site link that something took over (next/link cancels the browser's own
 * navigation) with a plain left click, to another page. Null for anything the browser loads itself (a plain link, a
 * new tab, a download, another site), which the service worker answers, and for a jump within the same page.
 */
function routedTarget(event: MouseEvent): string | null {
  if (!event.defaultPrevented || event.button !== 0) return null;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
  if (!anchor) return null;
  const target = anchor.getAttribute('target');
  if ((target && target !== '_self') || anchor.hasAttribute('download')) return null;
  const url = new URL(anchor.getAttribute('href') ?? '', window.location.href);
  if (url.origin !== window.location.origin) return null;
  const address = url.pathname + url.search;
  return address === here() ? null : address;
}

/**
 * True once an in-app navigation has been waiting `delayMs` while offline. With `experimental.useOffline`, a link to a
 * page this device never saved does not fail offline: Next keeps the navigation pending and finishes it when the
 * connection returns, and until then the screen does not change. This says so, for the connection indicator.
 *
 * Next does not expose its pending navigation, so it is followed from the click on a link the router took over
 * (listened on `window`, after React's own listener, so next/link has already cancelled the browser's navigation):
 * it is over when the path changes (the page opened), when the address already matches at the deadline (only the
 * query changed), or when the connection comes back (Next retries it then). Navigations started from code
 * (`router.push`) are not seen.
 */
export function usePendingNavigation(delayMs = PENDING_NAVIGATION_DELAY_MS): boolean {
  const offline = useIsOffline();
  const pathname = usePathname();
  /** The navigation being followed: where it goes, and one number per click so a new click restarts the wait. */
  const [started, setStarted] = useState<{ to: string; click: number } | null>(null);
  const [overdue, setOverdue] = useState(false);
  const [seen, setSeen] = useState({ pathname, offline });

  // Adjusted while rendering, so a stale hint never paints: the page opened, or the connection is back.
  if (seen.pathname !== pathname || seen.offline !== offline) {
    const over = seen.pathname !== pathname || (seen.offline && !offline);
    setSeen({ pathname, offline });
    if (over) {
      setStarted(null);
      setOverdue(false);
    }
  }

  useEffect(() => {
    let clicks = 0;
    const onClick = (event: MouseEvent) => {
      const to = routedTarget(event);
      if (to === null) return;
      clicks += 1;
      setStarted({ to, click: clicks });
      setOverdue(false);
    };
    window.addEventListener('click', onClick);
    return () => window.removeEventListener('click', onClick);
  }, []);

  useEffect(() => {
    if (!started) return;
    const timer = setTimeout(() => {
      if (here() === started.to) setStarted(null);
      else setOverdue(true);
    }, delayMs);
    return () => clearTimeout(timer);
  }, [started, delayMs]);

  return offline && overdue;
}
