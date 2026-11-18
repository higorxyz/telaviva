'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

const CLAMP = { 3: 'line-clamp-3', 8: 'line-clamp-8' } as const;

/** Clamped text (3 lines by default); the toggle appears only when the text is really clamped. */
export function ClampedText({ text, lines = 3 }: { text: string; lines?: keyof typeof CLAMP }) {
  const [open, setOpen] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);
  const id = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // While expanded there is nothing to measure, so the last result stands.
    const measure = () => {
      if (!open) setOverflowing(el.scrollHeight > el.clientHeight);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text, open]);

  return (
    <div>
      <p ref={ref} id={id} className={cn('text-sm leading-relaxed whitespace-pre-line text-ivory/85', !open && CLAMP[lines])}>
        {text}
      </p>
      {overflowing ? (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((v) => !v)}
          className="mt-1 rounded text-sm font-medium text-amber hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
        >
          {open ? 'Mostrar menos' : 'Ler mais'}
        </button>
      ) : null}
    </div>
  );
}
