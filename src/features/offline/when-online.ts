/** Resolves at once unless the browser knows it is offline (`navigator.onLine` false); then on its next `online`. */
export function whenOnline(): Promise<void> {
  if (typeof navigator === 'undefined' || navigator.onLine !== false) return Promise.resolve();
  return new Promise((resolve) => window.addEventListener('online', () => resolve(), { once: true }));
}
