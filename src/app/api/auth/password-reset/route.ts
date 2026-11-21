import { after } from 'next/server';
import { limitByIp, readJsonBody } from '@/lib/api-guard';
import { authGate, authRateLimiter, noStoreJson } from '@/server/auth/guard';
import { readResetEmail, RESET_MESSAGE, sendResetIfVerified } from '@/server/auth/password-reset';

const MAX_BODY_BYTES = 4 * 1024;

/**
 * Starts a password reset. The answer never says whether the e-mail has an account: it is always 200 with the same
 * message, a malformed or oversized body included. The lookup and the e-mail run in `after()`, once the response is
 * sent, so the response time cannot tell an existing, verified account from any other address either.
 */
export async function POST(request: Request) {
  const blocked = authGate(request) ?? limitByIp(request, authRateLimiter);
  if (blocked) return blocked;

  const body = await readJsonBody(request, MAX_BODY_BYTES);
  const email = body.ok ? readResetEmail(body.value) : null;
  if (email) after(() => sendResetIfVerified(email));

  return noStoreJson({ message: RESET_MESSAGE });
}
