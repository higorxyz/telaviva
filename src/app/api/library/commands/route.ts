import { parseCommand } from '@/features/library/command-schema';
import { readJsonBody } from '@/lib/api-guard';
import { describeError } from '@/lib/setup-error';
import { requireAccount } from '@/server/auth/account-guard';
import { jsonError, noStoreJson } from '@/server/auth/guard';
import { getDb } from '@/server/db/client';
import { LibraryAccountMissingError, LibraryConflictError, LibraryInvalidError, LibraryLimitError } from '@/server/library/errors';
import { applyLibraryCommand } from '@/server/library/store';

const MAX_COMMAND_BYTES = 64 * 1024;

function commandOf(body: unknown): unknown {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return undefined;
  return (body as { command?: unknown }).command;
}

/**
 * Applies one library command (`{ command }`) for the signed-in user and answers `{ library, previous }`: the library
 * as stored, and the title as it was before the command (what an undo puts back).
 */
export async function POST(request: Request) {
  const user = await requireAccount(request);
  if (user instanceof Response) return user;

  const body = await readJsonBody(request, MAX_COMMAND_BYTES);
  if (!body.ok) return body.status === 413 ? jsonError('payload_too_large', 413) : jsonError('invalid', 400);
  const command = parseCommand(commandOf(body.value));
  if (!command) return jsonError('invalid', 400);

  try {
    const { state, previous } = await applyLibraryCommand(await getDb(), user.id, command, new Date().toISOString());
    return noStoreJson({ library: state, previous });
  } catch (error) {
    if (error instanceof LibraryAccountMissingError) return jsonError('unauthenticated', 401);
    if (error instanceof LibraryInvalidError) return jsonError('invalid', 400);
    if (error instanceof LibraryConflictError) return jsonError('conflict', 409);
    if (error instanceof LibraryLimitError) return jsonError('limit', 413);
    console.error('[api/library/commands] could not apply the command:', describeError(error));
    return jsonError('server_error', 500);
  }
}
