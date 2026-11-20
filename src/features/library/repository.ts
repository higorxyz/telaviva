import type { LibraryCommand } from './commands';
import type { LibraryState } from './types';

/** `recovered`: some saved rows were unreadable; they were backed up and the rest of the library loaded. */
export type LibraryNotice = 'recovered';

export interface LibraryRepository {
  load(): Promise<LibraryState>;
  apply(command: LibraryCommand): Promise<LibraryState>;
  subscribe(onChange: () => void): () => void;
  /** Notices for the UI. One raised before anyone listens is delivered to the first listener. */
  onNotice?(listener: (notice: LibraryNotice) => void): () => void;
  /** False when the state only lives in memory (storage blocked or missing). */
  readonly persistent: boolean;
}
