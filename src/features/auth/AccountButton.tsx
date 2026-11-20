'use client';

import { User } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { cn } from '@/lib/cn';
import { useAuth } from './useAuth';

/** One footprint for the placeholder and the "Entrar" link, so the header does not move when sign-in resolves. */
const GUEST_BOX = 'h-9 w-20 shrink-0 rounded-full';
/** Stretches the 36 px visual to a 44 px touch target without taking layout space. */
const HIT_AREA = 'relative after:absolute after:-inset-1 after:content-[""]';

function Reserved() {
  return <span aria-hidden="true" className={GUEST_BOX} />;
}

function GuestLink() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const here = search ? `${pathname}?${search}` : pathname;
  return (
    <Link
      href={`/entrar?voltar=${encodeURIComponent(here)}`}
      className={cn(
        GUEST_BOX,
        HIT_AREA,
        'inline-flex items-center justify-center border border-ivory/30 bg-ink-950/40 text-sm font-medium text-ivory transition-colors hover:border-amber hover:text-amber motion-reduce:transition-none',
      )}
    >
      Entrar
    </Link>
  );
}

function initialOf(name: string | null, email: string | null): string | null {
  const source = name?.trim() || email?.trim() || '';
  const first = Array.from(source)[0];
  return first ? first.toLocaleUpperCase('pt-BR') : null;
}

function SignedInLink() {
  const pathname = usePathname();
  const { user } = useAuth();
  const initial = initialOf(user?.name ?? null, user?.email ?? null);
  return (
    <Link
      href="/conta"
      aria-label="Sua conta"
      aria-current={pathname === '/conta' ? 'page' : undefined}
      className={cn(
        HIT_AREA,
        'inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-ink-600 bg-ink-800 text-sm font-semibold text-amber transition-colors hover:border-amber aria-[current=page]:border-amber motion-reduce:transition-none',
      )}
    >
      {initial ? <span aria-hidden="true">{initial}</span> : <User aria-hidden="true" className="size-4" />}
    </Link>
  );
}

/** The account entry of the header: "Entrar" for visitors, the initial for people who are signed in. */
export function AccountButton() {
  const { status } = useAuth();
  if (status === 'disabled') return null;
  if (status === 'loading') return <Reserved />;
  if (status === 'guest') {
    // useSearchParams opts a static page out of prerendering up to the nearest Suspense: keep it small.
    return (
      <Suspense fallback={<Reserved />}>
        <GuestLink />
      </Suspense>
    );
  }
  return <SignedInLink />;
}
