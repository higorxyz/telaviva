'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AccountButton } from '@/features/auth/AccountButton';
import { cn } from '@/lib/cn';
import { SearchPaletteLauncher } from '@/features/search/SearchPaletteLauncher';
import { SearchTrigger } from '@/features/search/SearchTrigger';
import { PAGE_CONTAINER } from '@/ui/container';
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
      {/* Top scrim while the header is transparent: keeps the wordmark and links legible on bright backdrops.
          Over the plain page background it is invisible, so it needs no per-page switch. */}
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-x-0 top-0 -z-10 h-32 bg-linear-to-b from-ink-950/70 via-ink-950/35 via-50% to-transparent transition-opacity duration-200 motion-reduce:transition-none',
          scrolled && 'opacity-0',
        )}
      />
      <div className={cn(PAGE_CONTAINER, 'flex h-16 items-center gap-8')}>
        <Link href="/" aria-label="TelaViva, página inicial" className="rounded-sm">
          {/* Soft halo while transparent: on mobile no side shade helps the logo over bright skies. */}
          <Wordmark className={cn('transition-[text-shadow]', !scrolled && 'text-shadow-lg text-shadow-ink-950/80')} />
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
                      // Brighter than ivory-muted: these links sit on photography while the header is transparent.
                      active ? 'text-ivory' : 'text-ivory/80 hover:text-ivory',
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
        <div className="ml-auto flex shrink-0 items-center gap-3">
          <SearchTrigger className="hidden md:flex" />
          <AccountButton />
        </div>
        <SearchPaletteLauncher />
      </div>
    </header>
  );
}
