'use client';

import { useState } from 'react';
import type { Video } from '@/features/tmdb/types';

/** Lightweight facade: the YouTube iframe only loads after the click (or immediately with `autoPlay`). */
export function Trailer({ video, title, autoPlay = false }: { video: Video; title: string; autoPlay?: boolean }) {
  const [playing, setPlaying] = useState(autoPlay);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-ink-600 bg-ink-900 shadow-poster">
      {playing ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${video.key}?autoplay=1`}
          title={`Trailer de ${title}`}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 size-full"
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label={`Assistir trailer de ${title}`}
          className="group absolute inset-0 grid size-full place-items-center focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-amber"
        >
          <img
            src={`https://i.ytimg.com/vi/${video.key}/hqdefault.jpg`}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 size-full object-cover"
          />
          <span aria-hidden="true" className="absolute inset-0 bg-ink-950/40 transition-colors group-hover:bg-ink-950/20" />
          <span
            aria-hidden="true"
            className="relative grid size-16 place-items-center rounded-full bg-amber pl-1 text-2xl text-ink-950 shadow-glow transition-transform group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          >
            ▶
          </span>
        </button>
      )}
    </div>
  );
}
