/**
 * Header of a page warm-up: a plain fetch (no RSC header) that `tv-pages` stores like a visit. Sent by the app
 * (src/features/offline/useWarmWatching.ts) and read by the worker, so this file imports nothing: importing the rules
 * would put Serwist in the app's bundle.
 */
export const WARM_HEADER = 'X-TelaViva-Warm';
