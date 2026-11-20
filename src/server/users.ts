import 'server-only';
import { sql } from 'drizzle-orm';
import type { Database } from '@/server/db/client';
import { users } from '@/server/db/schema';

export type UserProfile = {
  id: string;
  email: string | null;
  name: string | null;
  photoUrl: string | null;
};

/** Creates the user on first sign-in; later sign-ins refresh the profile Firebase reports. */
export async function upsertUser(db: Database, profile: UserProfile): Promise<void> {
  const { id, email, name, photoUrl } = profile;
  await db
    .insert(users)
    .values({ id, email, name, photoUrl })
    .onConflictDoUpdate({
      target: users.id,
      set: { email, name, photoUrl, updatedAt: sql`now()` },
    });
}
