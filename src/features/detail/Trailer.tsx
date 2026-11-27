'use client';

import { Play } from 'lucide-react';
import { useLayoutEffect, useRef, useState, type SyntheticEvent } from 'react';
import type { Video } from '@/features/tmdb/types';

/** Sharpest first; maxres (1280×720) is missing for some videos, sd (640×480) for a few old ones. */
export const THUMBNAILS = ['maxresdefault', 'sddefault', 'hqdefault'] as const;

/**
 * Where the first try uses maxres: from md, where the player is wider than 640 px. Below, the player is at most
 * ~350 px wide and sd is sharp enough at 1.75×; its 4:3 letterbox bars fall exactly in what `object-cover` crops from
 * a 16:9 box. That keeps ~50 KB off the phone's first load of every title page.
 */
export const WIDE_THUMBNAIL_MEDIA = '(min-width: 768px)';

/** YouTube answers a missing size with a 120×90 grey placeholder (sometimes with status 200), not just an error. */
const PLACEHOLDER_WIDTH = 120;

/**
 * Navigates the player frame without a history entry. Changing `src` would push one into the page's joint
 * session history, so the next browser Back would rewind the hidden iframe (restarting the video) instead of
 * leaving the page. Cross-origin frames still allow `location.replace`.
 */
function replaceFrame(frame: HTMLIFrameElement, url: string) {
  try {
    frame.contentWindow?.location.replace(url);
  } catch {
    // No window (already detached): nothing is playing.
  }
}

function Cover({ videoKey }: { videoKey: string }) {
  const [index, setIndex] = useState(0);
  const next = () => setIndex((i) => Math.min(i + 1, THUMBNAILS.length - 1));
  const check = (img: HTMLImageElement | null) => {
    // Loaded (or failed) before hydration attached the handlers: judge it now.
    if (img?.complete && img.naturalWidth <= PLACEHOLDER_WIDTH) next();
  };
  const url = (size: (typeof THUMBNAILS)[number]) => `https://i.ytimg.com/vi/${videoKey}/${size}.jpg`;
  const img = (
    <img
      ref={check}
      // On the first try a narrow screen shows sd; a failure (or YouTube's placeholder) moves on like a missing maxres.
      src={url(index === 0 ? 'sddefault' : THUMBNAILS[index])}
      alt=""
      loading="lazy"
      decoding="async"
      onError={next}
      onLoad={(e: SyntheticEvent<HTMLImageElement>) => {
        if (e.currentTarget.naturalWidth <= PLACEHOLDER_WIDTH) next();
      }}
      className="absolute inset-0 size-full object-cover"
    />
  );
  if (index > 0) return <span key={index}>{img}</span>;
  return (
    <picture key={index}>
      <source media={WIDE_THUMBNAIL_MEDIA} srcSet={url('maxresdefault')} />
      {img}
    </picture>
  );
}

/** Lightweight facade: the YouTube iframe only loads after the click (or immediately with `autoPlay`). */
export function Trailer({ video, title, autoPlay = false }: { video: Video; title: string; autoPlay?: boolean }) {
  const [playing, setPlaying] = useState(autoPlay);
  const frame = useRef<HTMLIFrameElement>(null);
  const embed = `https://www.youtube-nocookie.com/embed/${video.key}?autoplay=1`;

  // With cacheComponents, leaving the route hides it in a React <Activity> instead of unmounting it, and a
  // display:none iframe keeps playing. Hiding runs this cleanup: blank the player at once, then drop the iframe
  // so the facade is back when the route returns. (Inside the hero dialog, the dialog itself closes on hide.)
  useLayoutEffect(() => {
    const el = frame.current;
    if (!el) return;
    // Strict Mode re-runs effects right after mounting: bring back a player that is still meant to play.
    if (el.dataset.stopped !== undefined) {
      delete el.dataset.stopped;
      replaceFrame(el, embed);
    }
    return () => {
      el.dataset.stopped = '';
      replaceFrame(el, 'about:blank');
      if (!autoPlay) setPlaying(false);
    };
  }, [playing, embed, autoPlay]);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-ink-600 bg-ink-900 shadow-poster">
      {playing ? (
        <iframe
          ref={frame}
          src={embed}
          title={`Trailer de ${title}`}
          // `fullscreen` in allow covers allowFullScreen (having both logs a console warning).
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
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
          <Cover videoKey={video.key} />
          <span aria-hidden="true" className="absolute inset-0 bg-ink-950/30 transition-colors group-hover:bg-ink-950/10" />
          <span
            aria-hidden="true"
            className="relative grid size-16 place-items-center rounded-full bg-amber text-ink-950 shadow-glow transition-transform group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          >
            <Play className="size-7 translate-x-0.5 fill-current" />
          </span>
        </button>
      )}
    </div>
  );
}
