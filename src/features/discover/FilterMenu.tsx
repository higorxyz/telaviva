'use client';

import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { PopoverSheet, type PopoverContext } from '@/ui/PopoverSheet';
import { triggerClass } from './panel-styles';

export type MenuContext = Pick<PopoverContext, 'close' | 'titleId'>;

/** One filter dimension: a toolbar trigger plus a popover/sheet holding its controls. */
export function FilterMenu({
  label,
  summary,
  open,
  onOpenChange,
  onClear,
  children,
}: {
  label: string;
  /** Current value shown on the trigger ("2", "2010–2019"); null when the dimension is unset. */
  summary: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClear: () => void;
  children: (ctx: MenuContext) => ReactNode;
}) {
  return (
    <PopoverSheet
      open={open}
      onOpenChange={onOpenChange}
      title={label}
      trigger={(props) => (
        <button type="button" {...props} className={triggerClass(summary !== null, open)}>
          {summary ? `${label} · ${summary}` : label}
          <ChevronDown
            aria-hidden="true"
            className={cn('size-4 transition-transform motion-reduce:transition-none', open && 'rotate-180')}
          />
        </button>
      )}
      headerActions={({ focusClose }) =>
        summary ? (
          <button
            type="button"
            onClick={() => {
              // This button disappears once the dimension is clear; keep focus inside the panel.
              focusClose();
              onClear();
            }}
            className="h-11 rounded-full px-3 text-sm text-ivory-muted underline hover:text-ivory focus-visible:outline-2 focus-visible:outline-amber"
          >
            Limpar
          </button>
        ) : null
      }
    >
      {children}
    </PopoverSheet>
  );
}
