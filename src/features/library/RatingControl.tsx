'use client';

import { Star } from 'lucide-react';
import { useRef, useState, type KeyboardEvent } from 'react';
import { cn } from '@/lib/cn';
import { PopoverSheet } from '@/ui/PopoverSheet';
import { RatingRing } from '@/ui/RatingRing';
import { UNDOABLE } from './copy';
import { useLibraryActions, useLibraryEntry } from './hooks';
import type { TitleRef, TitleSnapshot } from './types';

const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber';

function nextScore(key: string, from: number): number | null {
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return from === 10 ? 1 : from + 1;
    case 'ArrowLeft':
    case 'ArrowUp':
      return from === 1 ? 10 : from - 1;
    case 'Home':
      return 1;
    case 'End':
      return 10;
    default:
      return null;
  }
}

/** 1 to 10 as a radiogroup with a roving tab stop: arrows, Home and End move focus; Enter or Space pick. */
function ScorePicker({
  current,
  label,
  onPick,
}: {
  current: number | null;
  label: string;
  onPick: (score: number) => void;
}) {
  const [active, setActive] = useState(current ?? 1);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const next = nextScore(e.key, active);
    if (next === null) return;
    e.preventDefault();
    setActive(next);
    buttons.current[next - 1]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="grid w-max grid-cols-5 gap-2"
    >
      {SCORES.map((score) => (
        <button
          key={score}
          ref={(el) => {
            buttons.current[score - 1] = el;
          }}
          type="button"
          role="radio"
          aria-checked={current === score}
          tabIndex={active === score ? 0 : -1}
          onClick={() => onPick(score)}
          className={cn(
            'size-11 rounded-full border font-sans text-base font-semibold tabular-nums transition-colors hover:outline-2 hover:outline-offset-2 hover:outline-amber motion-reduce:transition-none',
            FOCUS,
            current === score
              ? 'border-ivory bg-ivory text-ink-950'
              : 'border-ink-600 bg-ink-800 text-ivory',
          )}
        >
          {score}
        </button>
      ))}
    </div>
  );
}

function RatingPanel({
  title,
  score,
  onPick,
  onRemove,
}: {
  title: string;
  score: number | null;
  onPick: (score: number) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-col items-start gap-3">
      <ScorePicker current={score} label={`Sua nota para ${title}`} onPick={onPick} />
      {score !== null ? (
        <button
          type="button"
          onClick={onRemove}
          className={cn(
            'h-11 rounded-full px-1 text-sm text-ivory-muted underline hover:text-ivory',
            FOCUS,
          )}
        >
          Remover nota
        </button>
      ) : null}
    </div>
  );
}

/** The visitor's own 1–10 score for a title: a trigger (ring when rated) and a popover/sheet to pick it. */
export function RatingControl({
  titleRef,
  snapshot,
  title,
}: {
  titleRef: TitleRef;
  snapshot: TitleSnapshot;
  title: string;
}) {
  const { ready, item, rating } = useLibraryEntry(titleRef);
  const { run } = useLibraryActions();
  const [open, setOpen] = useState(false);
  const score = ready ? (rating?.score ?? null) : null;
  const triggerClass = cn(
    'inline-flex h-11 min-w-36 shrink-0 items-center justify-center gap-2 rounded-full border border-ink-600 px-4 text-sm font-medium whitespace-nowrap text-ivory transition-colors hover:border-ivory/40 disabled:opacity-60 disabled:hover:border-ink-600 motion-reduce:transition-none',
    FOCUS,
    open && 'border-ivory/60',
  );

  return (
    <PopoverSheet
      open={open}
      onOpenChange={setOpen}
      title="Sua nota"
      trigger={(props) => (
        <button
          type="button"
          {...props}
          disabled={!ready}
          aria-label={
            score !== null
              ? `Sua nota para ${title}: ${score} de 10. Mudar nota`
              : `Dar nota para ${title}`
          }
          className={triggerClass}
        >
          {score !== null ? (
            <>
              <span aria-hidden="true" className="inline-flex">
                <RatingRing value={score} tone="personal" size="sm" />
              </span>
              <span aria-hidden="true">Sua nota</span>
            </>
          ) : (
            <>
              <Star aria-hidden="true" className="size-4" />
              <span aria-hidden="true">Dar nota</span>
            </>
          )}
        </button>
      )}
    >
      {(ctx) => (
        <RatingPanel
          title={title}
          score={score}
          onPick={(next) => {
            // Rating a movie marks it as watched: say so (and offer the way back) when that moves it.
            const moves = titleRef.mediaType === 'movie' && item?.status !== 'watched';
            run(
              { type: 'rate', ref: titleRef, score: next, snapshot },
              moves ? { undoable: UNDOABLE.movedToWatched } : undefined,
            );
            ctx.close();
          }}
          onRemove={() => {
            run({ type: 'unrate', ref: titleRef }, { undoable: UNDOABLE.ratingRemoved });
            ctx.close();
          }}
        />
      )}
    </PopoverSheet>
  );
}
