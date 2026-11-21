import { describeError } from '@/lib/setup-error';
import { requireAccount } from '@/server/auth/account-guard';
import { jsonError, noStoreJson } from '@/server/auth/guard';
import { getDb } from '@/server/db/client';
import { LibraryAccountMissingError } from '@/server/library/errors';
import { loadAccountLibrary } from '@/server/library/store';

/** The signed-in user's library (with `X-Expected-User` naming them). */
export async function GET(request: Request) {
  const user = await requireAccount(request);
  if (user instanceof Response) return user;

  try {
    return noStoreJson(await loadAccountLibrary(getDb(), user.id));
  } catch (error) {
    if (error instanceof LibraryAccountMissingError) return jsonError('unauthenticated', 401);
    console.error('[api/library] could not load the library:', describeError(error));
    return jsonError('server_error', 500);
  }
}
