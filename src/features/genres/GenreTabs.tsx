'use client';

import Link from 'next/link';
import { useRef, useState, type KeyboardEvent } from 'react';
import { cn } from '@/lib/cn';

export interface GenreCardData {
  id: number;
  name: string;
  href: string;
  /** Ready-to-use image URL, or null for the plain placeholder. */
  backdrop: string | null;
}

const TABS = [
  { key: 'movie', label: 'Filmes' },
  { key: 'tv', label: 'Séries' },
] as const;

type Key = (typeof TABS)[number]['key'];

function GenreCard({ genre }: { genre: GenreCardData }) {
  return (
    <Link
      href={genre.href}
      className="group relative isolate flex aspect-[16/9] items-end overflow-hidden rounded-xl border border-ink-600 bg-ink-800 p-4 transition duration-300 hover:border-amber hover:shadow-glow focus-visible:border-amber motion-reduce:transition-none"
    >
      {genre.backdrop ? (
        <img
          src={genre.backdrop}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 -z-20 size-full object-cover opacity-80 transition duration-500 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
      ) : null}
      <span aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-t from-ink-950 via-ink-950/40 to-transparent" />
      <span className="font-display text-3xl leading-none text-ivory">{genre.name}</span>
    </Link>
  );
}

/** Filmes | Séries switch over two server-rendered grids (both are in the HTML; the inactive one is `hidden`). */
export function GenreTabs({ movie, tv }: { movie: GenreCardData[]; tv: GenreCardData[] }) {
  const [active, setActive] = useState<Key>('movie');
  const refs = useRef<Record<Key, HTMLButtonElement | null>>({ movie: null, tv: null });
  const data = { movie, tv };

  function onKeyDown(event: KeyboardEvent) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const next: Key = active === 'movie' ? 'tv' : 'movie';
    setActive(next);
    refs.current[next]?.focus();
  }

  return (
    <div>
      <div role="tablist" aria-label="Tipo de título" className="mb-8 inline-flex rounded-full border border-ink-600 bg-ink-900 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            ref={(el) => {
              refs.current[tab.key] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${tab.key}`}
            aria-selected={active === tab.key}
            aria-controls={`panel-${tab.key}`}
            tabIndex={active === tab.key ? 0 : -1}
            onClick={() => setActive(tab.key)}
            onKeyDown={onKeyDown}
            className={cn(
              'rounded-full px-6 py-2 font-sans text-sm font-medium transition-colors motion-reduce:transition-none',
              active === tab.key ? 'bg-amber text-ink-950' : 'text-ivory-muted hover:text-ivory',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {TABS.map((tab) => (
        <div
          key={tab.key}
          role="tabpanel"
          id={`panel-${tab.key}`}
          aria-labelledby={`tab-${tab.key}`}
          hidden={active !== tab.key}
        >
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
            {data[tab.key].map((genre) => (
              <li key={genre.id}>
                <GenreCard genre={genre} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
