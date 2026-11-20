'use client';

import Link from 'next/link';
import { useAuth } from './useAuth';

/** Tells a visitor that signing in keeps the list on every device. Nothing for signed-in users or with sign-in off. */
export function SignInHint() {
  const { status } = useAuth();
  if (status !== 'guest') return null;
  return (
    <p className="mt-6 font-sans text-sm text-ivory-muted">
      Entre para ver sua lista em todos os aparelhos.{' '}
      <Link href="/entrar?voltar=/minha-lista" className="inline-flex min-h-11 items-center font-medium text-amber">
        Entrar
      </Link>
    </p>
  );
}
