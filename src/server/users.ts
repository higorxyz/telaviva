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

/**
 * Creates the user on first sign-in; later sign-ins refresh the profile Firebase reports. A token without a name or
 * picture claim (some providers and email sign-ins omit them) keeps the stored value instead of erasing it.
 */
export async function upsertUser(db: Database, profile: UserProfile): Promise<void> {
  const { id, email, name, photoUrl } = profile;
  await db
    .insert(users)
    .values({ id, email, name, photoUrl })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email,
        name: sql`coalesce(excluded."name", ${users.name})`,
        photoUrl: sql`coalesce(excluded."photo_url", ${users.photoUrl})`,
        updatedAt: sql`now()`,
      },
    });
}
