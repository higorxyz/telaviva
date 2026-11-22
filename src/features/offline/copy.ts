/** The connection indicator and the network-only actions (fixed copy, Phase 4 plan). */

export const OFFLINE_TEXT = 'Sem conexão. Suas ações serão enviadas quando a internet voltar.';
export const SYNCED_TEXT = 'Tudo sincronizado.';
export const PENDING_NAVIGATION_TEXT = 'Esta página abre quando a internet voltar.';
export const MY_LIST_LINK = 'Ver minha lista';

/** Signing in, creating an account, the reset link, exporting, deleting the account and resending the e-mail. */
export const NEEDS_NETWORK = 'Você precisa de internet para isso.';

export function queuedText(count: number): string {
  return count === 1 ? '1 ação aguardando envio' : `${count} ações aguardando envio`;
}

/** How long an in-app navigation waits offline before the indicator says the page opens later. */
export const PENDING_NAVIGATION_DELAY_MS = 1500;

/** How long "Tudo sincronizado." stays: as long as a toast. */
export const SYNCED_LIFETIME_MS = 5000;
