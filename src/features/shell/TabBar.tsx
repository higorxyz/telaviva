'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { isActive, TAB_ITEMS } from './nav';

export function TabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-ink-600 bg-ink-900/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-5">
        {TAB_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex h-14 flex-col items-center justify-center gap-1 text-[11px] transition-colors motion-reduce:transition-none',
                  active ? 'font-bold text-amber' : 'font-medium text-ivory-muted',
                )}
              >
                {/* Non-color cue for the current tab (WCAG 1.4.1): indicator bar plus a bolder label. */}
                {active ? (
                  <span
                    aria-hidden="true"
                    data-testid="tab-indicator"
                    className="absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-amber"
                  />
                ) : null}
                <Icon aria-hidden="true" className="size-5" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
