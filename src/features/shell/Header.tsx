'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { isActive, NAV_ITEMS } from './nav';
import { Wordmark } from './Wordmark';

export function Header() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-colors duration-200 motion-reduce:transition-none',
        scrolled ? 'bg-ink-950/85 backdrop-blur' : 'bg-transparent',
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-8 px-4 md:px-8">
        <Link href="/" aria-label="TelaViva, página inicial" className="rounded-sm">
          <Wordmark />
        </Link>
        <nav aria-label="Seções" className="hidden flex-1 md:block">
          <ul className="flex items-center gap-6">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'relative py-2 text-sm font-medium transition-colors motion-reduce:transition-none',
                      active ? 'text-ivory' : 'text-ivory-muted hover:text-ivory',
                    )}
                  >
                    {item.label}
                    {active ? (
                      <span aria-hidden="true" className="absolute inset-x-0 -bottom-0.5 h-0.5 rounded-full bg-amber" />
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <Link
          href="/buscar"
          className="hidden items-center gap-2 rounded-full border border-ink-600 bg-ink-800/60 px-4 py-2 text-sm text-ivory-muted transition-colors hover:text-ivory motion-reduce:transition-none md:flex"
        >
          <Search aria-hidden="true" className="size-4" />
          Buscar
          <kbd className="rounded border border-ink-600 px-1.5 text-xs text-ivory-muted">Ctrl K</kbd>
        </Link>
      </div>
    </header>
  );
}
