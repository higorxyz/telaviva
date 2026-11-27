import { requestDeadline } from '@/lib/request-timeout';
import { GUEST_LIBRARY_KEY } from '@/features/library/storage-key';
import { confirmedKey, preMergeKey } from './merge-on-login';

const EXPORT_FALLBACK_NAME = 'telaviva-meus-dados.json';

/** The export reads the whole account, so it gets more time than the other requests (REQUEST_TIMEOUT_MS). */
export const EXPORT_TIMEOUT_MS = 30_000;

const init: RequestInit = { credentials: 'same-origin', cache: 'no-store' };

/**
 * The uid the page shows, sent with every account action: the cookie is shared by all tabs, and another tab may have
 * signed in as someone else since. The server answers 409 when they differ.
 */
const forUser = (uid: string): RequestInit => ({ ...init, headers: { 'X-Expected-User': uid } });

/** The session belongs to someone else than the page shows (another tab switched accounts). */
export class WrongAccountError extends Error {
  constructor() {
    super('The session belongs to another account');
    this.name = 'WrongAccountError';
  }
}

/** The export met 401: the session must be renewed first (see `AuthApi.renewSession`). */
export class ExportSessionError extends Error {
  constructor() {
    super('The session is gone');
    this.name = 'ExportSessionError';
  }
}

/**
 * `deleted` (204), `reauth` (the sign-in is not recent, or the session is gone: signing in again fixes both),
 * `wrong_account` (409: the session is someone else's), `offline` (the request never reached the server) or `error`
 * (anything else, a 502 included: trying again is safe).
 */
export type DeleteResult = 'deleted' | 'reauth' | 'wrong_account' | 'offline' | 'error';

export async function requestAccountDeletion(expectedUid: string): Promise<DeleteResult> {
  // No answer in time is `error`, not `offline`: the request may have reached the server, and trying again is safe.
  const deadline = requestDeadline();
  let response: Response;
  try {
    response = await fetch('/api/account', { ...forUser(expectedUid), method: 'DELETE', signal: deadline.signal });
  } catch {
    return deadline.expired ? 'error' : 'offline';
  } finally {
    deadline.clear();
  }
  if (response.status === 204) return 'deleted';
  if (response.status === 409) return 'wrong_account';
  return response.status === 401 ? 'reauth' : 'error';
}

function filenameOf(response: Response): string {
  const match = /filename="([^"]+)"/.exec(response.headers.get('content-disposition') ?? '');
  return match?.[1] ?? EXPORT_FALLBACK_NAME;
}

/**
 * Downloads the account export through fetch → Blob → `a[download]` (instead of a plain link) so a failure can be
 * told to the person. Throws when the export did not arrive (`WrongAccountError` on a 409, `ExportSessionError` on
 * a 401).
 */
export async function downloadAccountExport(expectedUid: string): Promise<void> {
  // The clock covers the body too: a stalled download must fail rather than leave the button busy forever.
  const deadline = requestDeadline(EXPORT_TIMEOUT_MS);
  let response: Response;
  let blob: Blob;
  try {
    response = await fetch('/api/account/export', { ...forUser(expectedUid), signal: deadline.signal });
    if (response.status === 409) throw new WrongAccountError();
    if (response.status === 401) throw new ExportSessionError();
    if (!response.ok) throw new Error(`The export answered ${response.status}`);
    blob = await response.blob();
  } finally {
    deadline.clear();
  }
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = filenameOf(response);
  link.hidden = true;
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    // Some browsers read the blob after click() returns.
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  }
}

function removeFrom(store: () => Storage, keys: string[]) {
  try {
    const storage = store();
    for (const key of keys) storage.removeItem(key);
  } catch {
    // Blocked storage holds nothing to remove.
  }
}

/**
 * After the account is deleted, removes what this device kept of it: the visitor's library (merged into the account),
 * the copy taken before that merge, and the merge's fingerprint. Other people's backups stay. The library goes even
 * when the uid is not known any more.
 */
export function clearLocalAccountData(uid: string | null): void {
  removeFrom(() => window.localStorage, uid ? [GUEST_LIBRARY_KEY, preMergeKey(uid), confirmedKey(uid)] : [GUEST_LIBRARY_KEY]);
  if (uid) removeFrom(() => window.sessionStorage, [confirmedKey(uid)]);
}
