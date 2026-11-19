import type { EpisodeSummary } from '@/features/tmdb/types';
import { formatDate } from '@/lib/format';
import { AccentTitle } from '@/ui/AccentTitle';

/** "Próximo episódio" callout: T/E, name and air date. */
export function NextEpisode({ episode }: { episode: EpisodeSummary }) {
  const date = formatDate(episode.airDate) ?? 'Data a definir';
  return (
    <aside aria-label="Próximo episódio" className="mt-6 max-w-3xl rounded-xl border border-amber/40 bg-ink-900 p-4 font-sans">
      <AccentTitle as="h3" lead="Próximo" accent="episódio" className="text-xl" />
      <p className="mt-1 text-ivory">
        {`T${episode.seasonNumber}E${episode.episodeNumber}`}
        {episode.name ? ` · ${episode.name}` : ''} · <span className="text-ivory-muted">{date}</span>
      </p>
    </aside>
  );
}
