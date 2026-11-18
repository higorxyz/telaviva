export const OPEN_PALETTE_EVENT = 'telaviva:open-search';

/** Asks the mounted SearchPalette to open (used by the header trigger). */
export function openSearchPalette(): void {
  window.dispatchEvent(new Event(OPEN_PALETTE_EVENT));
}
