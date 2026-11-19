import { tmdbImage } from '@/features/tmdb/images';
import type { Provider, WatchProviders as Providers } from '@/features/tmdb/types';

const GROUPS = [
  ['flatrate', 'Streaming'],
  ['free', 'Grátis'],
  ['ads', 'Com anúncios'],
  ['rent', 'Aluguel'],
  ['buy', 'Compra'],
] as const;

function ProviderLogo({ provider }: { provider: Provider }) {
  const src = tmdbImage(provider.logoPath, 'w92');
  return (
    <li className="flex w-16 flex-col items-center gap-1.5 text-center">
      {src ? (
        <img src={src} alt="" width={48} height={48} loading="lazy" className="size-12 rounded-xl border border-ink-600" />
      ) : (
        <span aria-hidden="true" className="grid size-12 place-items-center rounded-xl border border-ink-600 bg-ink-800 font-display text-lg text-ivory-muted">
          {provider.name.charAt(0)}
        </span>
      )}
      <span className="font-sans text-xs text-ivory-muted">{provider.name}</span>
    </li>
  );
}

export function WatchProviders({ providers }: { providers: Providers }) {
  const groups = GROUPS.filter(([key]) => providers[key].length > 0);

  return (
    <div className="space-y-5">
      {groups.length === 0 ? (
        <p className="text-ivory-muted">Ainda não disponível em streaming no Brasil.</p>
      ) : (
        groups.map(([key, label]) => (
          <div key={key}>
            <h3 className="mb-2 font-sans text-xs font-medium tracking-[0.18em] text-amber uppercase">{label}</h3>
            <ul className="flex flex-wrap gap-4">
              {providers[key].map((p) => (
                <ProviderLogo key={p.id} provider={p} />
              ))}
            </ul>
          </div>
        ))
      )}
      <p className="font-sans text-xs text-ivory-muted">
        Dados de streaming fornecidos por JustWatch.
        {providers.link ? (
          <>
            {' '}
            <a
              href={providers.link}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded text-ivory underline hover:text-amber"
            >
              Ver opções no TMDb<span className="sr-only"> (abre em nova aba)</span>
            </a>
          </>
        ) : null}
      </p>
    </div>
  );
}
