import { normalizeLibraryState, parseLibraryEntries } from '@/features/library/schema';
import type { LibraryState } from '@/features/library/types';
import { readJsonBody } from '@/lib/api-guard';
import { describeError } from '@/lib/setup-error';
import { requireAccount } from '@/server/auth/account-guard';
import { jsonError, noStoreJson } from '@/server/auth/guard';
import { getDb } from '@/server/db/client';
import { LibraryAccountMissingError, LibraryInvalidError, LibraryLimitError } from '@/server/library/errors';
import { mergeGuestLibrary } from '@/server/library/merge';

/** A whole visitor library: far larger than one command (plan, "Limites"). */
const MAX_MERGE_BYTES = 2 * 1024 * 1024;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * The visitor's library from `{ library }`, read as leniently as the local repository reads it: an unreadable row is
 * dropped on its own (the rest still merges), an oversized snapshot is trimmed. Null when there is no v1 library.
 */
function guestOf(body: unknown): LibraryState | null {
  if (!isRecord(body) || !isRecord(body.library)) return null;
  const parsed = parseLibraryEntries(body.library);
  if (!parsed) return null;
  if (parsed.dropped > 0) {
    // Counts only: the rows hold the user's data.
    console.warn(`[api/library/merge] left out ${parsed.dropped} unreadable guest row(s)`);
  }
  return normalizeLibraryState(parsed.state);
}

/** Merges the visitor's library (`{ library }`) into the signed-in user's and answers the library as stored. */
export async function POST(request: Request) {
  const user = await requireAccount(request);
  if (user instanceof Response) return user;

  const body = await readJsonBody(request, MAX_MERGE_BYTES);
  if (!body.ok) return body.status === 413 ? jsonError('payload_too_large', 413) : jsonError('invalid', 400);
  const guest = guestOf(body.value);
  if (!guest) return jsonError('invalid', 400);

  try {
    const state = await mergeGuestLibrary(await getDb(), user.id, guest, new Date().toISOString());
    return noStoreJson(state);
  } catch (error) {
    if (error instanceof LibraryAccountMissingError) return jsonError('unauthenticated', 401);
    if (error instanceof LibraryInvalidError) return jsonError('invalid', 400);
    if (error instanceof LibraryLimitError) return jsonError('limit', 413);
    console.error('[api/library/merge] could not merge the guest library:', describeError(error));
    return jsonError('server_error', 500);
  }
}
