import { noStoreJson, requireUser } from '@/server/auth/guard';

/** The signed-in user, from the session cookie. */
export async function GET(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  return noStoreJson({ user });
}
