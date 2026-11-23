'use client';

import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type PointerEvent } from 'react';
import { AccentTitle } from '@/ui/AccentTitle';
import { cn } from '@/lib/cn';
import type { CardItem } from './card-item';
import { PosterCard } from './PosterCard';
import { RAIL_ITEM_CLASS, RAIL_SIZES } from './sizes';

const DRAG_THRESHOLD = 4;

export function Rail({
  id,
  title,
  href,
  items,
  priorityCount = 0,
  subtitleOf,
  ringOf,
}: {
  id: string;
  title: { lead: string; accent?: string };
  href?: string;
  items: CardItem[];
  /** Posters with index < priorityCount load eagerly (above-the-fold rail only). */
  priorityCount?: number;
  /** Replaces the year under a poster; undefined falls back to the year. */
  subtitleOf?: (item: CardItem) => string | undefined;
  /** Overrides the corner ring of a poster (e.g. the personal rating); undefined keeps the TMDb average. */
  ringOf?: (item: CardItem) => { value: number | null; tone: 'tmdb' | 'personal' } | undefined;
}) {
  const label = [title.lead, title.accent].filter(Boolean).join(' ');
  const listRef = useRef<HTMLUListElement>(null);
  const drag = useRef({ active: false, startX: 0, startScroll: 0, moved: false });
  const [overflow, setOverflow] = useState({ start: false, end: false });
  const [active, setActive] = useState(0);

  const measure = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const start = el.scrollLeft > 4;
    const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    setOverflow((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
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
    e.currentTarget.removeAttribute('data-dragging');
  }

  function onPointerMove(e: PointerEvent<HTMLUListElement>) {
    const d = drag.current;
    if (!d.active) return;
    const dx = e.clientX - d.startX;
    if (!d.moved && Math.abs(dx) > DRAG_THRESHOLD) {
      d.moved = true;
      // Snap fights programmatic scrollLeft, so it is off while dragging.
      e.currentTarget.setAttribute('data-dragging', '');
    }
    if (d.moved) e.currentTarget.scrollLeft = d.startScroll - dx;
  }

  function endDrag() {
    const d = drag.current;
    if (!d.active) return;
    d.active = false;
    listRef.current?.removeAttribute('data-dragging');
    // Deferred so the click that follows a real drag is still suppressed.
    setTimeout(() => {
      if (!drag.current.active) drag.current.moved = false;
    }, 0);
  }

  function onClickCapture(e: React.MouseEvent) {
    // detail === 0: keyboard-generated click, never part of a pointer drag.
    if (e.detail !== 0 && drag.current.moved) {
      e.preventDefault();
      e.stopPropagation();
      drag.current.moved = false;
    }
  }

  const posterLinks = (list: HTMLUListElement) =>
    Array.from(list.querySelectorAll<HTMLAnchorElement>(':scope > li > div > a[href]'));

  /** Roving tab stop: one Tab stop per rail; arrows, Home and End move between posters. */
  function onKeyDown(e: KeyboardEvent<HTMLUListElement>) {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) return;
    const links = posterLinks(e.currentTarget);
    const current = links.findIndex((a) => a === document.activeElement);
    if (current === -1) return;
    const target =
      e.key === 'Home' ? 0 : e.key === 'End' ? links.length - 1 : current + (e.key === 'ArrowRight' ? 1 : -1);
    const next = links[target];
    if (!next) return;
    e.preventDefault();
    setActive(target);
    next.focus();
  }

  function onFocus(e: FocusEvent<HTMLUListElement>) {
    const index = posterLinks(e.currentTarget).findIndex((a) => a === (e.target as Element));
    if (index !== -1) setActive(index);
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
            className="inline-flex shrink-0 items-center gap-1 rounded font-sans text-sm text-ivory-muted transition-colors hover:text-amber focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
          >
            Ver tudo <ArrowRight aria-hidden="true" className="size-4" />
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
          onPointerCancel={endDrag}
          onDragStart={(e) => e.preventDefault()}
          onClickCapture={onClickCapture}
          onKeyDown={onKeyDown}
          onFocus={onFocus}
          // The scroller clips vertically too: the padding (offset by negative margins, so nothing shifts) leaves
          // room for the hover lift, its glow and the focus ring of the first and last posters.
          className="-mx-3 -mt-3 flex snap-x snap-mandatory scroll-px-3 gap-3 overflow-x-auto overscroll-x-contain px-3 pt-3 pb-4 [scrollbar-width:none] data-dragging:snap-none sm:gap-4 [&::-webkit-scrollbar]:hidden"
        >
          {items.map((item, i) => {
            const ring = ringOf?.(item);
            return (
              <li key={`${item.mediaType}-${item.id}`} className={cn(RAIL_ITEM_CLASS, 'shrink-0 snap-start')}>
                <PosterCard
                  item={item}
                  sizes={RAIL_SIZES}
                  priority={i < priorityCount}
                  tabIndex={i === Math.min(active, items.length - 1) ? 0 : -1}
                  subtitle={subtitleOf?.(item)}
                  ringValue={ring?.value}
                  ringTone={ring?.tone}
                />
              </li>
            );
          })}
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
              {side === 'start' ? (
                <ChevronLeft aria-hidden="true" className="size-5" />
              ) : (
                <ChevronRight aria-hidden="true" className="size-5" />
              )}
            </button>
          ) : null,
        )}
      </div>
    </section>
  );
}
