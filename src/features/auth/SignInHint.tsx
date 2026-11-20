'use client';

import Link from 'next/link';
import { useAuth } from './useAuth';

/** Tells a visitor that signing in keeps the list on every device. Nothing for signed-in users or with sign-in off. */
export function SignInHint() {
  const { status } = useAuth();
  // While sign-in resolves, hold the line's space so a guest's list does not jump down. Off and signed in: no line.
  if (status === 'loading') return <div aria-hidden="true" className="mt-6 min-h-11" />;
  if (status !== 'guest') return null;
  return (
    <p className="mt-6 min-h-11 font-sans text-sm text-ivory-muted">
      Entre para ver sua lista em todos os aparelhos.{' '}
      <Link href="/entrar?voltar=/minha-lista" className="inline-flex min-h-11 items-center font-medium text-amber">
        Entrar
      </Link>
    </p>
  );
}
