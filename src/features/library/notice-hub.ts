import type { LibraryNotice } from './repository';

/** Notices for the UI; one raised before anyone listens is kept for the first listener (`onNotice`'s contract). */
export function createNoticeHub() {
  const listeners = new Set<(notice: LibraryNotice) => void>();
  let pending: LibraryNotice | null = null;
  return {
    notify(notice: LibraryNotice) {
      if (listeners.size === 0) pending = notice;
      else listeners.forEach((listener) => listener(notice));
    },
    onNotice(listener: (notice: LibraryNotice) => void): () => void {
      listeners.add(listener);
      if (pending) {
        const notice = pending;
        pending = null;
        listener(notice);
      }
      return () => listeners.delete(listener);
    },
  };
}
