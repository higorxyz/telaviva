'use client';

import { Download, LoaderCircle, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, ButtonLink } from '@/ui/Button';
import { Skeleton } from '@/ui/Skeleton';
import { useToast } from '@/ui/toast/useToast';
import { downloadAccountExport, WrongAccountError } from './account-client';
import { EXPORT_ERROR, STALE_ACCOUNT } from './account-copy';
import { AccountDetails } from './AccountDetails';
import { initialOf } from './AccountButton';
import { DeleteAccount } from './DeleteAccount';
import type { SessionUser } from './session-client';
import { useAuth } from './useAuth';

const SECTION = 'border-t border-ink-700 pt-6';

function AccountSkeleton() {
  return (
    <div className="mt-10">
      <p role="status" className="sr-only">
        Carregando sua conta…
      </p>
      <div aria-hidden="true" className="flex items-center gap-5">
        <Skeleton className="size-16 shrink-0 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-8 w-48 max-w-full" />
          <Skeleton className="mt-2 h-4 w-60 max-w-full" />
        </div>
      </div>
      <Skeleton className="mt-10 h-20 w-full" />
      <Skeleton className="mt-10 h-32 w-full rounded-2xl" />
    </div>
  );
}

function Avatar({ user }: { user: SessionUser }) {
  const [broken, setBroken] = useState(false);
  const initial = initialOf(user.name, user.email);
  if (user.photoUrl && !broken) {
    return (
      <img
        src={user.photoUrl}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className="size-16 shrink-0 rounded-full border border-ink-600 bg-ink-800 object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="inline-flex size-16 shrink-0 items-center justify-center rounded-full border border-ink-600 bg-ink-800 font-display text-3xl text-amber"
    >
      {initial ?? '?'}
    </span>
  );
}

/**
 * The /conta screen (Operate mode: sober, everything findable at a glance): who is signed in, how, and whether the
 * e-mail is confirmed (with "Reenviar e-mail" beside it when not); "Sair", "Exportar meus dados" and, set apart in the
 * wine accent, "Excluir minha conta".
 */
export function AccountView() {
  const auth = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [leaving, setLeaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  if (auth.status === 'disabled') return null;
  if (auth.status === 'loading' || leaving) return <AccountSkeleton />;
  const user = auth.user;
  if (auth.status === 'guest' || !user) {
    return (
      <div className="mt-8">
        <p className="max-w-[60ch] font-sans text-base text-ivory-muted">
          Entre para ver sua conta, exportar seus dados ou excluir a conta.
        </p>
        <ButtonLink variant="primary" href="/entrar?voltar=/conta" className="mt-6">
          Entrar
        </ButtonLink>
      </div>
    );
  }

  const uid = user.id;

  async function signOut() {
    setLeaving(true);
    await auth.signOut();
    router.push('/');
  }

  async function exportData() {
    if (exporting) return;
    setExporting(true);
    try {
      await downloadAccountExport(uid);
    } catch (error) {
      const stale = error instanceof WrongAccountError;
      toast.show({ message: stale ? STALE_ACCOUNT : EXPORT_ERROR, tone: 'error' });
      if (stale) void auth.refresh();
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="mt-10">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-6">
        <Avatar user={user} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-3xl leading-tight text-ivory">{user.name ?? user.email}</p>
          {user.name && user.email ? (
            <p className="mt-0.5 truncate font-sans text-base text-ivory-muted">{user.email}</p>
          ) : null}
        </div>
        <Button variant="ghost" size="sm" onClick={signOut}>
          <LogOut aria-hidden="true" className="size-4" />
          Sair
        </Button>
      </div>

      <AccountDetails user={user} className={`mt-8 ${SECTION}`} />

      <section aria-labelledby="conta-dados" className={`mt-10 ${SECTION}`}>
        <h2 id="conta-dados" className="font-sans text-base font-medium text-ivory">
          Seus dados
        </h2>
        <p className="mt-1 max-w-[60ch] font-sans text-sm text-ivory-muted">
          Uma cópia do seu perfil e da sua lista, num arquivo JSON.
        </p>
        <Button variant="ghost" onClick={exportData} aria-disabled={exporting || undefined} className="mt-4">
          {exporting ? (
            <LoaderCircle aria-hidden="true" className="size-4 motion-safe:animate-spin" />
          ) : (
            <Download aria-hidden="true" className="size-4" />
          )}
          Exportar meus dados
        </Button>
      </section>

      <section aria-labelledby="conta-excluir" className="mt-12 rounded-2xl border border-wine bg-wine/15 p-5 sm:p-6">
        <h2 id="conta-excluir" className="font-sans text-base font-medium text-ivory">
          Excluir conta
        </h2>
        <p className="mt-1 mb-4 max-w-[60ch] font-sans text-sm text-ivory">
          Apaga sua conta e toda a sua lista, em todos os aparelhos. Não dá para desfazer.
        </p>
        <DeleteAccount onLeaving={() => setLeaving(true)} />
      </section>
    </div>
  );
}
