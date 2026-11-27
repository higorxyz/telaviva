import 'server-only';
import { publicFirebaseConfig } from '@/lib/auth-config';
import { looksLikeEmail } from '@/lib/email';
import { env } from '@/lib/env';
import { describeError } from '@/lib/setup-error';
import { getAdminAuth } from './admin';

const isUserNotFound = (error: unknown) =>
  (error as { code?: unknown } | null)?.code === 'auth/user-not-found';

export { RESET_MESSAGE } from '@/features/auth/reset-copy';

const LOG = '[api/auth/password-reset]';
const SEND_TIMEOUT_MS = 10_000;

/** The trimmed e-mail of a `{ email }` body, or null when it is missing or plainly not an e-mail. */
export function readResetEmail(value: unknown): string | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const { email } = value as { email?: unknown };
  if (typeof email !== 'string') return null;
  const trimmed = email.trim();
  return looksLikeEmail(trimmed) ? trimmed : null;
}

/** Identity Toolkit's sendOobCode endpoint, or the Auth emulator's copy of it when FIREBASE_AUTH_EMULATOR_HOST is set. */
export function sendOobCodeUrl(apiKey: string): string {
  const emulator = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const base = emulator
    ? `http://${emulator}/identitytoolkit.googleapis.com`
    : 'https://identitytoolkit.googleapis.com';
  return `${base}/v1/accounts:sendOobCode?key=${encodeURIComponent(apiKey)}`;
}

/**
 * Asks Firebase to e-mail a reset link, only to an account that exists AND confirmed its e-mail: an unconfirmed
 * address may belong to someone else (anyone can sign up with it), so the link must not go there.
 *
 * Never throws, and logs failures without the e-mail. The route runs it after the response is sent, so neither the
 * lookup nor the send can show in the response time.
 */
export async function sendResetIfVerified(email: string): Promise<void> {
  try {
    let verified = false;
    try {
      verified = (await getAdminAuth().getUserByEmail(email)).emailVerified;
    } catch (error) {
      if (isUserNotFound(error)) return;
      throw error;
    }
    if (!verified) return;

    const apiKey = publicFirebaseConfig?.apiKey;
    if (!apiKey) {
      console.error(`${LOG} NEXT_PUBLIC_FIREBASE_API_KEY is not set: the reset e-mail was not sent.`);
      return;
    }
    const response = await fetch(sendOobCodeUrl(apiKey), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Firebase writes the e-mail in this language when the template is the default one.
        'X-Firebase-Locale': 'pt-BR',
        // The site itself, like the browser's own calls with this key. The key must still carry no HTTP-referrer
        // restriction (docs/setup/fase3-contas.md): a server's Referer is not something to rely on.
        Referer: `${new URL(env.SITE_URL).origin}/`,
      },
      body: JSON.stringify({ requestType: 'PASSWORD_RESET', email }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    // The body is not read: Firebase's error text can quote the address.
    if (!response.ok) console.error(`${LOG} Firebase refused to send the reset e-mail (HTTP ${response.status}).`);
  } catch (error) {
    console.error(`${LOG} could not send the reset e-mail:`, describeError(error));
  }
}
