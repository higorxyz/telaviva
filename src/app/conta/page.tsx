import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AccountView } from '@/features/auth/AccountView';
import { pageMeta } from '@/features/share/page-meta';
import { authEnabled } from '@/lib/auth-config';
import { AccentTitle } from '@/ui/AccentTitle';

export const metadata: Metadata = pageMeta({
  title: 'Sua conta',
  description: 'Sua conta no TelaViva: sair, exportar seus dados ou excluir a conta.',
  path: '/conta',
  noindex: true,
});

/**
 * Static: `authEnabled` is fixed at build time, so with sign-in off the page is a build-time 404. Who is signed in is
 * read on the client (the page never reads cookies), with a neutral placeholder until then.
 */
export default function ContaPage() {
  if (!authEnabled) notFound();
  return (
    <div className="mx-auto w-full max-w-[40rem] px-4 pt-28 pb-16 md:pt-36">
      <AccentTitle as="h1" lead="Sua" accent="conta" className="text-5xl leading-[1.02] md:text-6xl" />
      <AccountView />
    </div>
  );
}
