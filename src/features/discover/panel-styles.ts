import { cn } from '@/lib/cn';

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber';

export const SELECT_CLASS = cn(
  'h-11 w-full rounded-lg border border-ink-600 bg-ink-800 px-3 text-sm text-ivory transition-colors hover:border-ivory/40 motion-reduce:transition-none',
  FOCUS,
);

export const LABEL_CLASS = 'mb-2 block text-sm font-medium text-ivory';

/** Multi-select chips and quick picks inside a popover; 44px tall on touch screens. */
export const toggleClass = (on: boolean) =>
  cn(
    'rounded-full border text-sm font-medium transition-colors motion-reduce:transition-none',
    FOCUS,
    on ? 'border-amber bg-amber text-ink-950' : 'border-ink-600 text-ivory-muted hover:border-ivory/40 hover:text-ivory',
  );

/** Toolbar trigger: amber once its dimension holds a value, brighter outline while its popover is open. */
export const triggerClass = (active: boolean, open: boolean) =>
  cn(
    'inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border pr-3 pl-4 text-sm font-medium whitespace-nowrap transition-colors motion-reduce:transition-none',
    FOCUS,
    active ? 'border-amber/70 bg-amber/10 text-amber' : 'border-ink-600 text-ivory hover:border-ivory/40',
    open && !active && 'border-ivory/60',
    open && active && 'border-amber',
  );

/** Segment of a segmented control (the group draws the outline as a ring, so segments keep the full 44px). */
export const segmentClass = (on: boolean) =>
  cn(
    'h-11 shrink-0 grow rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors motion-reduce:transition-none',
    FOCUS,
    on ? 'bg-amber text-ink-950' : 'text-ivory-muted hover:text-ivory',
  );

export const SEGMENTED_CLASS = 'inline-flex shrink-0 rounded-full bg-ink-900 ring-1 ring-ink-600';
