'use client';

import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { cn } from '@/lib/cn';
import { hasInAppHistory } from './in-app-history';

/**
 * "Voltar": goes back when the user arrived from inside the app (keeping the previous page's scroll and filters),
 * otherwise to `fallbackHref`. A PWA in standalone mode has no browser back button.
 */
export function BackButton({ fallbackHref, className }: { fallbackHref: string; className?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      aria-busy={pending || undefined}
      onClick={() => startTransition(() => (hasInAppHistory() ? router.back() : router.push(fallbackHref)))}
      className={cn(
        'inline-flex min-h-11 items-center gap-2 rounded-full bg-ink-950/60 py-2 pr-4 pl-3 text-sm font-medium text-ivory backdrop-blur transition-colors hover:bg-ink-800/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber motion-reduce:transition-none',
        className,
      )}
    >
      <ArrowLeft aria-hidden="true" className={cn('size-4', pending && 'animate-pulse motion-reduce:animate-none')} />
      Voltar
    </button>
  );
}
