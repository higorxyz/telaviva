'use client';

import { useId, useState } from 'react';
import { cn } from '@/lib/cn';

const LONG = 200;

/** Three-line synopsis with a toggle; short texts render without a button. */
export function ClampedText({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div>
      <p id={id} className={cn('text-sm leading-relaxed text-ivory/85', !open && 'line-clamp-3')}>
        {text}
      </p>
      {text.length > LONG ? (
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
