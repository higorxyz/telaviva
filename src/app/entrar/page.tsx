import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { SignInView } from '@/features/auth/SignInView';
import { pageMeta } from '@/features/share/page-meta';
import { authEnabled } from '@/lib/auth-config';
import { AccentTitle } from '@/ui/AccentTitle';
import { Skeleton } from '@/ui/Skeleton';

export const metadata: Metadata = pageMeta({
  title: 'Entrar',
  description: 'Entre no TelaViva para guardar sua lista e acompanhar suas séries em todos os aparelhos.',
  path: '/entrar',
  noindex: true,
});

/** The view's shape while `?voltar=` is read on the client: Google, divider, tabs, two fields, the button. */
function SignInSkeleton() {
  return (
    <div aria-hidden="true" className="mt-10">
      <Skeleton className="h-12 w-full rounded-full" />
      <Skeleton className="mx-auto my-8 h-4 w-32" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="mt-12 h-12 w-full rounded-xl" />
      <Skeleton className="mt-14 h-12 w-full rounded-xl" />
      <Skeleton className="mt-6 h-12 w-full rounded-full" />
    </div>
  );
}

/**
 * Static: `authEnabled` is fixed at build time, so with sign-in off the page is a build-time 404. The view reads
 * `?voltar=` and the sign-in state on the client, inside Suspense.
 */
export default function EntrarPage() {
  if (!authEnabled) notFound();
  return (
    <div className="mx-auto w-full max-w-[26rem] px-4 pt-28 pb-16 md:pt-36">
      <AccentTitle as="h1" lead="Entrar no" accent="TelaViva" className="text-5xl leading-[1.02] md:text-6xl" />
      <Suspense fallback={<SignInSkeleton />}>
        <SignInView />
      </Suspense>
    </div>
  );
}
