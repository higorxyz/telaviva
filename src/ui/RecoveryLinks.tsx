import Link from 'next/link';
import { ButtonLink } from './Button';

const SHORTCUTS = [
  { href: '/buscar', label: 'Buscar' },
  { href: '/filmes', label: 'Filmes' },
  { href: '/series', label: 'Séries' },
];

type Shortcut = { href: string; label: string };

/** Way out of a 404 or error page: one primary action plus search and the main sections (or other shortcuts). */
export function RecoveryLinks({ primary, shortcuts = SHORTCUTS }: { primary?: Shortcut; shortcuts?: Shortcut[] }) {
  return (
    <nav aria-label="Atalhos" className="mt-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-3">
      {primary ? (
        <ButtonLink href={primary.href} variant="primary">
          {primary.label}
        </ButtonLink>
      ) : null}
      {shortcuts.map((s) => (
        <Link
          key={s.href}
          href={s.href}
          className="rounded text-ivory-muted hover:text-ivory hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
        >
          {s.label}
        </Link>
      ))}
    </nav>
  );
}
