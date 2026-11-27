import { parseEnvelope } from '@/features/library/command-schema';
import { readJsonBody } from '@/lib/api-guard';
import { describeError } from '@/lib/setup-error';
import { requireAccount } from '@/server/auth/account-guard';
import { jsonError, noStoreJson } from '@/server/auth/guard';
import { getDb } from '@/server/db/client';
import {
  LibraryAccountMissingError,
  LibraryConflictError,
  LibraryInvalidError,
  LibraryLimitError,
  LibraryStaleError,
} from '@/server/library/errors';
import { applyLibraryCommand } from '@/server/library/store';

const MAX_COMMAND_BYTES = 64 * 1024;

/**
 * Applies one library command (`{ command, at?, commandId? }`) for the signed-in user and answers
 * `{ library, previous }`: the library as stored, and the title as it was before the command (what an undo puts
 * back). The offline queue sends the time of the action (`at`) and the command's id (a resend applies once); an
 * action older than 30 days is refused with 400 `{ error: 'stale' }`.
 */
export async function POST(request: Request) {
  const user = await requireAccount(request);
  if (user instanceof Response) return user;

  const body = await readJsonBody(request, MAX_COMMAND_BYTES);
  if (!body.ok) return body.status === 413 ? jsonError('payload_too_large', 413) : jsonError('invalid', 400);
  const envelope = parseEnvelope(body.value);
  if (!envelope) return jsonError('invalid', 400);

  try {
    const { command, at, commandId } = envelope;
    const now = new Date().toISOString();
    const { state, previous } = await applyLibraryCommand(await getDb(), user.id, command, now, { at, commandId });
    return noStoreJson({ library: state, previous });
  } catch (error) {
    if (error instanceof LibraryAccountMissingError) return jsonError('unauthenticated', 401);
    if (error instanceof LibraryInvalidError) return jsonError('invalid', 400);
    if (error instanceof LibraryStaleError) return jsonError('stale', 400);
    if (error instanceof LibraryConflictError) return jsonError('conflict', 409);
    if (error instanceof LibraryLimitError) return jsonError('limit', 413);
    console.error('[api/library/commands] could not apply the command:', describeError(error));
    return jsonError('server_error', 500);
  }
}
