import { NextResponse } from 'next/server';
import { limitByIp } from '@/lib/api-guard';
import { describeError } from '@/lib/setup-error';
import { exportAccount, exportFilename } from '@/server/account';
import { authRateLimiter, jsonError, requireUser } from '@/server/auth/guard';
import { getDb } from '@/server/db/client';

/** Everything kept about the signed-in user, as a JSON download (LGPD). Revoked sessions are refused. */
export async function GET(request: Request) {
  const user = await requireUser(request, { checkRevoked: true });
  if (user instanceof Response) return user;
  const limited = limitByIp(request, authRateLimiter);
  if (limited) return limited;

  const now = new Date();
  try {
    const data = await exportAccount(getDb(), user, now);
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${exportFilename(now)}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('[api/account/export] could not export the account:', describeError(error));
    return jsonError('server_error', 500);
  }
}
