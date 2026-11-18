export const OPEN_PALETTE_EVENT = 'telaviva:open-search';

/** Asks the mounted SearchPalette to open; `opener` gets focus back on close (Safari doesn't focus clicked buttons). */
export function openSearchPalette(opener?: HTMLElement | null): void {
  window.dispatchEvent(new CustomEvent<HTMLElement | null>(OPEN_PALETTE_EVENT, { detail: opener ?? null }));
}
