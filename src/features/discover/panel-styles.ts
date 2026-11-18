export const SELECT_CLASS =
  'h-11 w-full rounded-lg border border-ink-600 bg-ink-800 px-3 text-sm text-ivory focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber';

export const LABEL_CLASS = 'mb-2 block text-sm font-medium text-ivory';

export const toggleClass = (on: boolean) =>
  `rounded-full border text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber motion-reduce:transition-none ${
    on ? 'border-amber bg-amber text-ink-950' : 'border-ink-600 text-ivory-muted hover:text-ivory'
  }`;
