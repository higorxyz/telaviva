'use client';

import { Play, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Video } from '@/features/tmdb/types';
import { buttonClasses } from '@/ui/Button';
import { cn } from '@/lib/cn';
import { Trailer } from './Trailer';

/** "Assistir trailer" button that opens the trailer in a native modal dialog (top layer, focus trapped). */
export function HeroTrailer({ video, title, className }: { video: Video; title: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  // Leaving the route (browser Back included) hides it in a React <Activity> rather than unmounting it: close the
  // dialog right away so the player stops, the page scroll unlocks, and the route comes back with it closed.
  useLayoutEffect(() => {
    const el = dialog.current;
    return () => {
      if (el?.open) el.close();
      setOpen(false);
    };
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={cn(buttonClasses({ variant: 'primary', size: 'lg' }), className)}
      >
        <Play aria-hidden="true" className="size-5 fill-current" /> Assistir trailer
      </button>
      <dialog
        ref={dialog}
        aria-label={`Trailer de ${title}`}
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpen(false);
        }}
        className="m-auto w-[min(96vw,64rem,calc((100dvh-7rem)*16/9))] max-w-none overflow-visible bg-transparent p-0 backdrop:bg-ink-950/85"
      >
        {open ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute -top-12 right-0 inline-flex h-10 items-center gap-2 rounded-full border border-ivory/35 px-4 font-sans text-sm text-ivory hover:border-ivory/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
            >
              Fechar <X aria-hidden="true" className="size-4" />
            </button>
            <Trailer video={video} title={title} autoPlay />
          </div>
        ) : null}
      </dialog>
    </>
  );
}
