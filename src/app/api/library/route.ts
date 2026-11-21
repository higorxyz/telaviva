import { limitByIp } from '@/lib/api-guard';
import { describeError } from '@/lib/setup-error';
import { requireAccount } from '@/server/auth/account-guard';
import { jsonError, libraryRateLimiter, noStoreJson } from '@/server/auth/guard';
import { getDb } from '@/server/db/client';
import { loadLibrary } from '@/server/library/store';


/** The signed-in user's library. */
export async function GET(request: Request) {
  const user = await requireAccount(request);
  if (user instanceof Response) return user;
  const limited = limitByIp(request, libraryRateLimiter);
  if (limited) return limited;

  try {
    return noStoreJson(await loadLibrary(getDb(), user.id));
  } catch (error) {
    console.error('[api/library] could not load the library:', describeError(error));
    return jsonError('server_error', 500);
  }
}
