import type { LibraryCommand } from './commands';
import type { LibraryState } from './types';

export interface LibraryRepository {
  load(): Promise<LibraryState>;
  apply(command: LibraryCommand): Promise<LibraryState>;
  subscribe(onChange: () => void): () => void;
  /** False when the state only lives in memory (storage blocked or missing). */
  readonly persistent: boolean;
}
