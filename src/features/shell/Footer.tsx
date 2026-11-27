import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { PAGE_CONTAINER } from '@/ui/container';
import { Wordmark } from './Wordmark';

type FooterLink = { href: string; label: string };

const GROUPS: { title: string; links: FooterLink[] }[] = [
  {
    title: 'Navegar',
    links: [
      { href: '/', label: 'Início' },
      { href: '/filmes', label: 'Filmes' },
      { href: '/series', label: 'Séries' },
      { href: '/descobrir', label: 'Descobrir' },
      { href: '/generos', label: 'Gêneros' },
      { href: '/minha-lista', label: 'Minha lista' },
    ],
  },
  {
    title: 'Listas',
    links: [
      { href: '/filmes/em-cartaz', label: 'Em cartaz' },
      { href: '/filmes/em-breve', label: 'Em breve' },
      { href: '/filmes/mais-bem-avaliados', label: 'Mais bem avaliados' },
      { href: '/filmes/joias-escondidas', label: 'Joias escondidas' },
      { href: '/series/no-ar-hoje', label: 'Séries no ar hoje' },
      { href: '/series/em-alta', label: 'Séries em alta' },
    ],
  },
];

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber';

function SocialLink({ href, label, children }: { href: string; label: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className={cn(
        'grid size-11 place-items-center rounded-full border border-ink-600 text-ivory-muted transition-colors hover:border-amber/60 hover:text-amber',
        FOCUS,
      )}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[1.125rem] fill-current">
        {children}
      </svg>
    </a>
  );
}

export function Footer() {
  return (
    // Bottom padding clears the fixed mobile TabBar (h-14 + safe area), so the credits row stays visible.
    <footer className="mt-24 border-t border-ink-600 bg-ink-900 pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">
      <div
        className={cn(
          PAGE_CONTAINER,
          'grid gap-x-8 gap-y-12 pb-12 pt-14 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)] lg:pt-16',
        )}
      >
        <div className="max-w-sm space-y-5">
          <Wordmark className="text-4xl" />
          <p className="text-pretty text-ivory-muted">
            Descubra filmes e séries, veja onde assistir no Brasil e guarde o que quer ver depois.
          </p>
          <div className="flex gap-3">
            <SocialLink href="https://github.com/higorxyz" label="GitHub de Higor Batista">
              <path d="M12 .3a12 12 0 0 0-3.8 23.38c.6.12.83-.26.83-.57l-.02-2.04c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.33-1.76-1.33-1.76-1.09-.74.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.49 1 .1-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.1-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23.64 1.66.24 2.88.12 3.18a4.65 4.65 0 0 1 1.23 3.22c0 4.61-2.8 5.63-5.48 5.92.43.37.82 1.1.82 2.22l-.02 3.29c0 .31.22.69.83.57A12 12 0 0 0 12 .3" />
            </SocialLink>
            <SocialLink href="https://www.linkedin.com/in/higorbatista" label="LinkedIn de Higor Batista">
              <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z" />
            </SocialLink>
          </div>
        </div>
        <nav aria-label="Rodapé" className="grid grid-cols-2 gap-8 lg:col-span-2 lg:grid-cols-2">
          {GROUPS.map((group) => (
            <div key={group.title} className="space-y-4">
              <h2 className="font-display text-xl text-ivory">{group.title}</h2>
              <ul className="space-y-1">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className={cn(
                        'inline-flex min-h-9 items-center rounded text-ivory-muted transition-colors hover:text-ivory',
                        FOCUS,
                      )}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
      <div className="border-t border-ink-700">
        <div
          className={cn(
            PAGE_CONTAINER,
            'flex flex-col gap-4 py-6 text-xs text-ivory-muted md:flex-row md:items-center md:justify-between',
          )}
        >
          <p>
            Powered by{' '}
            <a
              href="https://www.themoviedb.org/"
              target="_blank"
              rel="noopener noreferrer"
              className={cn('rounded font-semibold text-amber hover:underline', FOCUS)}
            >
              TMDB API
            </a>{' '}
            &amp;{' '}
            <a
              href="https://www.justwatch.com/br"
              target="_blank"
              rel="noopener noreferrer"
              className={cn('rounded font-semibold text-ivory hover:underline', FOCUS)}
            >
              JustWatch
            </a>
          </p>
          <p>
            Feito por <span className="text-ivory">Higor Batista</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
