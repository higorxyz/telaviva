import type { EpisodeSummary } from '@/features/tmdb/types';
import { formatDate } from '@/lib/format';

/** "Próximo episódio" callout: T/E, name and air date. */
export function NextEpisode({ episode }: { episode: EpisodeSummary }) {
  const date = formatDate(episode.airDate) ?? 'Data a definir';
  return (
    <aside aria-label="Próximo episódio" className="mt-6 max-w-3xl rounded-xl border border-amber/40 bg-ink-900 p-4 font-sans">
      <p className="text-xs font-medium tracking-[0.18em] text-amber uppercase">Próximo episódio</p>
      <p className="mt-1 text-ivory">
        {`T${episode.seasonNumber}E${episode.episodeNumber}`}
        {episode.name ? ` · ${episode.name}` : ''} · <span className="text-ivory-muted">{date}</span>
      </p>
    </aside>
  );
}
