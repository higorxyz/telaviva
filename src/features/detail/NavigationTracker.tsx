'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { markInAppNavigation } from './in-app-history';

/** Renders nothing; flags the tab once the pathname changes after the first render (a client navigation). */
export function NavigationTracker() {
  const pathname = usePathname();
  const first = useRef(pathname);
  useEffect(() => {
    if (pathname !== first.current) markInAppNavigation();
  }, [pathname]);
  return null;
}
