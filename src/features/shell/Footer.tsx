import Link from 'next/link';
import { cn } from '@/lib/cn';
import { PAGE_CONTAINER } from '@/ui/container';
import { NAV_ITEMS } from './nav';
import { Wordmark } from './Wordmark';

const external = { target: '_blank', rel: 'noopener noreferrer' } as const;

export function Footer() {
  return (
    <footer className="mt-24 border-t border-ink-600 bg-ink-900">
      <div className={cn(PAGE_CONTAINER, 'grid gap-10 py-12 md:grid-cols-[1fr_auto_auto]')}>
        <div className="space-y-3">
          <Wordmark />
          <p className="max-w-xs text-sm text-ivory-muted">Descubra filmes e séries, com onde assistir no Brasil.</p>
        </div>
        <nav aria-label="Rodapé">
          <ul className="space-y-2 text-sm">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-ivory-muted transition-colors hover:text-ivory">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="space-y-2 text-sm text-ivory-muted">
          <p>Feito por Higor Batista</p>
          <ul className="space-y-2">
            <li>
              <a href="https://github.com/higorxyz" {...external} className="hover:text-ivory">
                GitHub
              </a>
            </li>
            <li>
              <a href="https://www.linkedin.com/in/higorbatista" {...external} className="hover:text-ivory">
                LinkedIn
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-ink-700">
        <div className={cn(PAGE_CONTAINER, 'flex flex-col gap-4 py-6 text-xs text-ivory-muted md:flex-row md:items-center')}>
          <img src="/brand/tmdb.svg" alt="TMDB" width={137} height={18} className="h-4.5 w-auto" />
          <p>Este produto usa a API do TMDB, mas não é endossado ou certificado pelo TMDB.</p>
        </div>
      </div>
    </footer>
  );
}
