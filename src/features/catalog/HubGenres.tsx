import Link from 'next/link';
import { getGenres } from '@/features/tmdb/genres';
import type { Genre, MediaType } from '@/features/tmdb/types';
import { genreHref, mediaTypeToTipo } from '@/lib/slug';
import { AccentTitle } from '@/ui/AccentTitle';

const CHIP =
  'inline-flex h-10 items-center rounded-full border border-ink-600 bg-ink-900 px-4 font-sans text-sm text-ivory transition-colors hover:border-amber hover:text-amber focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber motion-reduce:transition-none';
const LINK =
  'rounded font-sans text-sm text-ivory-muted transition-colors hover:text-amber focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber';

/** "Por gênero" block of a hub: one chip per genre, plus the way to every genre and to /descobrir. */
export async function HubGenres({ media }: { media: MediaType }) {
  // Genres are cached for days; if TMDb is down the block simply disappears (the rails already guard the page).
  const genres: Genre[] = await getGenres(media).catch(() => []);
  if (genres.length === 0) return null;
  return (
    <section aria-labelledby={`generos-${media}`}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <AccentTitle as="h2" id={`generos-${media}`} lead="Por" accent="gênero" className="text-2xl sm:text-3xl" />
        <div className="flex gap-5">
          <Link href="/generos" className={LINK}>
            Ver todos os gêneros <span aria-hidden="true">→</span>
          </Link>
          <Link href={`/descobrir?tipo=${mediaTypeToTipo(media)}`} className={LINK}>
            Descobrir <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
      <ul className="flex flex-wrap gap-2">
        {genres.map((g) => (
          <li key={g.id}>
            <Link href={genreHref({ mediaType: media, ...g })} className={CHIP}>
              {g.name}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
