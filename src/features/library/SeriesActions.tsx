'use client';

import { Bookmark, Check, Play, Plus } from 'lucide-react';
import { useState } from 'react';
import type { TvDetails } from '@/features/tmdb/types';
import { cn } from '@/lib/cn';
import { PopoverSheet, type PopoverContext } from '@/ui/PopoverSheet';
import { STATUS_LABEL, UNDOABLE } from './copy';
import { useLibraryActions, useLibraryEntry } from './hooks';
import type { TvProgressInfo } from './progress';
import { RatingControl } from './RatingControl';
import { toSnapshot } from './snapshot';
import type { LibraryStatus, TitleRef } from './types';

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber';

const STATUSES: { status: LibraryStatus; label: string; Icon: typeof Bookmark }[] = [
  { status: 'want', label: STATUS_LABEL.want, Icon: Bookmark },
  { status: 'watching', label: STATUS_LABEL.watching, Icon: Play },
  { status: 'watched', label: STATUS_LABEL.watched, Icon: Check },
];

const optionClass = (pressed: boolean) =>
  cn(
    'flex h-11 w-full items-center gap-3 rounded-full border px-4 text-left text-sm font-medium transition-colors motion-reduce:transition-none',
    FOCUS,
    pressed ? 'border-ivory bg-ivory text-ink-950' : 'border-ink-600 text-ivory hover:border-ivory/40',
  );

function StatusPanel({
  current,
  ctx,
  onPick,
  onRemove,
}: {
  current: LibraryStatus | null;
  ctx: PopoverContext;
  onPick: (status: LibraryStatus) => void;
  onRemove: () => void;
}) {
  return (
    <div role="group" aria-labelledby={ctx.titleId} className="flex flex-col gap-2">
      {STATUSES.map(({ status, label, Icon }) => (
        <button
          key={status}
          type="button"
          aria-pressed={current === status}
          onClick={() => onPick(status)}
          className={optionClass(current === status)}
        >
          <Icon aria-hidden="true" className="size-4" />
          {label}
        </button>
      ))}
      {current !== null ? (
        <button
          type="button"
          onClick={onRemove}
          className={cn('mt-1 h-11 self-start rounded-full px-1 text-sm text-ivory-muted underline hover:text-ivory', FOCUS)}
        >
          Remover da lista
        </button>
      ) : null}
    </div>
  );
}

/** Status selector ("Quero ver" / "Assistindo" / "Assistido") and the personal rating, for a series page. */
export function SeriesActions({
  tv,
  info,
}: {
  tv: Pick<TvDetails, 'id' | 'title' | 'posterPath' | 'releaseDate' | 'genreIds'>;
  info: TvProgressInfo;
}) {
  const ref: TitleRef = { mediaType: 'tv', tmdbId: tv.id };
  const { ready, item } = useLibraryEntry(ref);
  const { run } = useLibraryActions();
  const [open, setOpen] = useState(false);
  const snapshot = toSnapshot(tv);
  const current = ready ? (item?.status ?? null) : null;
  const shown = STATUSES.find((s) => s.status === current);
  const TriggerIcon = shown?.Icon ?? Plus;

  return (
    <>
      <PopoverSheet
        open={open}
        onOpenChange={setOpen}
        title="Status na sua lista"
        trigger={(props) => (
          <button
            type="button"
            {...props}
            disabled={!ready}
            className={cn(
              'inline-flex h-11 min-w-44 shrink-0 items-center justify-center gap-2 rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-colors disabled:opacity-60 motion-reduce:transition-none',
              FOCUS,
              current ? 'border-ivory bg-ivory text-ink-950' : 'border-ink-600 text-ivory hover:border-ivory/40',
            )}
          >
            <TriggerIcon aria-hidden="true" className="size-4" />
            {shown?.label ?? 'Adicionar à lista'}
          </button>
        )}
      >
        {(ctx) => (
          <StatusPanel
            current={current}
            ctx={ctx}
            onPick={(status) => {
              if (status !== current) {
                run(
                  { type: 'setStatus', ref, status, snapshot, progress: info },
                  current === null && status === 'want' ? { undoable: UNDOABLE.saved } : undefined,
                );
              }
              ctx.close();
            }}
            onRemove={() => {
              run({ type: 'remove', ref }, { undoable: UNDOABLE.removed });
              ctx.close();
            }}
          />
        )}
      </PopoverSheet>
      <RatingControl titleRef={ref} snapshot={snapshot} title={tv.title} />
    </>
  );
}
