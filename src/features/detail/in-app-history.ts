const KEY = 'tv:in-app-nav';

let navigated = false;

/** Called on the first client-side route change of this tab; later calls are no-ops. */
export function markInAppNavigation(): void {
  if (navigated) return;
  navigated = true;
  try {
    sessionStorage.setItem(KEY, '1');
  } catch {
    // Storage blocked: the module flag still covers this page load.
  }
}

/**
 * True when this tab already navigated inside the app, so `router.back()` stays on the site. Unlike `history.length`
 * it ignores entries from other sites; direct links, new tabs and PWA launches start without the flag.
 */
export function hasInAppHistory(): boolean {
  if (navigated) return true;
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/** Test-only reset of the module flag. */
export function resetInAppHistoryForTests(): void {
  navigated = false;
}
