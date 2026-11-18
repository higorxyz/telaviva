'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { MediaSummary } from '@/features/tmdb/types';
import { AccentTitle } from '@/ui/AccentTitle';
import { PosterCard } from './PosterCard';

const DRAG_THRESHOLD = 4;
const CARD_SIZES = '(min-width: 1024px) 15vw, (min-width: 640px) 22vw, 38vw';

export function Rail({
  id,
  title,
  href,
  items,
}: {
  id: string;
  title: { lead: string; accent?: string };
  href?: string;
  items: MediaSummary[];
}) {
  const label = [title.lead, title.accent].filter(Boolean).join(' ');
  const listRef = useRef<HTMLUListElement>(null);
  const drag = useRef({ active: false, startX: 0, startScroll: 0, moved: false });
  const [overflow, setOverflow] = useState({ start: false, end: false });

  const measure = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    setOverflow({
      start: el.scrollLeft > 4,
      end: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    });
  }, []);

  useEffect(() => {
    measure();
    const el = listRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure, items.length]);

  function scrollByPage(direction: 1 | -1) {
    const el = listRef.current;
    if (!el) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: reduce ? 'auto' : 'smooth' });
  }

  function onPointerDown(e: PointerEvent<HTMLUListElement>) {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    drag.current = { active: true, startX: e.clientX, startScroll: e.currentTarget.scrollLeft, moved: false };
  }

  function onPointerMove(e: PointerEvent<HTMLUListElement>) {
    const d = drag.current;
    if (!d.active) return;
    const dx = e.clientX - d.startX;
    if (!d.moved && Math.abs(dx) > DRAG_THRESHOLD) d.moved = true;
    if (d.moved) e.currentTarget.scrollLeft = d.startScroll - dx;
  }

  function endDrag() {
    drag.current.active = false;
  }

  function onClickCapture(e: React.MouseEvent) {
    if (drag.current.moved) {
      e.preventDefault();
      e.stopPropagation();
      drag.current.moved = false;
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLUListElement>) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const links = Array.from(e.currentTarget.querySelectorAll<HTMLAnchorElement>('a[href]'));
    const current = links.findIndex((a) => a === document.activeElement);
    if (current === -1) return;
    const next = links[current + (e.key === 'ArrowRight' ? 1 : -1)];
    if (!next) return;
    e.preventDefault();
    next.focus();
  }

  return (
    <section id={id} aria-label={label} className="group/rail relative">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <AccentTitle
          as="h2"
          lead={title.lead}
          accent={title.accent}
          className="text-2xl sm:text-3xl"
        />
        {href ? (
          <Link
            href={href}
            aria-label={`Ver tudo: ${label}`}
            className="shrink-0 rounded font-sans text-sm text-ivory-muted transition-colors hover:text-amber focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
          >
            Ver tudo <span aria-hidden="true">→</span>
          </Link>
        ) : null}
      </div>
      <div className="relative">
        <ul
          ref={listRef}
          onScroll={measure}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerLeave={endDrag}
          onClickCapture={onClickCapture}
          onKeyDown={onKeyDown}
          className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-4 [scrollbar-width:none] sm:gap-4 [&::-webkit-scrollbar]:hidden"
        >
          {items.map((item, i) => (
            <li
              key={`${item.mediaType}-${item.id}`}
              className="w-[38vw] max-w-44 shrink-0 snap-start sm:w-36 lg:w-40"
            >
              <PosterCard item={item} sizes={CARD_SIZES} priority={i < 2} />
            </li>
          ))}
        </ul>
        {(['start', 'end'] as const).map((side) =>
          overflow[side] ? (
            <button
              key={side}
              type="button"
              aria-label={side === 'start' ? 'Rolar para a esquerda' : 'Rolar para a direita'}
              onClick={() => scrollByPage(side === 'start' ? -1 : 1)}
              className={`absolute top-[38%] hidden size-10 -translate-y-1/2 place-items-center rounded-full border border-ink-600 bg-ink-900/90 text-ivory shadow-poster transition-colors hover:border-amber hover:text-amber focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber md:grid ${
                side === 'start' ? 'left-1' : 'right-1'
              }`}
            >
              <span aria-hidden="true">{side === 'start' ? '‹' : '›'}</span>
            </button>
          ) : null,
        )}
      </div>
    </section>
  );
}
