// No `server-only` here on purpose: drizzle-kit and tsx load this file outside Next.js,
// where that package throws. It holds no secrets; the client (client.ts) is the guarded entry.
import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';

/** Timestamps round-trip as strings, matching the ISO strings of the library types. */
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'string' });

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email'),
  name: text('name'),
  photoUrl: text('photo_url'),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const libraryItems = pgTable(
  'library_items',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    mediaType: text('media_type').notNull(),
    tmdbId: integer('tmdb_id').notNull(),
    status: text('status').notNull(),
    addedAt: ts('added_at').notNull().defaultNow(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
    watchedAt: ts('watched_at'),
    title: text('title').notNull(),
    posterPath: text('poster_path'),
    releaseDate: text('release_date'),
    genreIds: integer('genre_ids')
      .array()
      .notNull()
      .default(sql`'{}'::integer[]`),
  },
  (t) => [
    unique('library_items_user_media_tmdb_unique').on(t.userId, t.mediaType, t.tmdbId),
    check('library_items_media_type_check', sql`${t.mediaType} in ('movie', 'tv')`),
    check('library_items_status_check', sql`${t.status} in ('want', 'watching', 'watched')`),
    index('library_items_user_id_idx').on(t.userId),
  ],
);

export const episodeProgress = pgTable(
  'episode_progress',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tvId: integer('tv_id').notNull(),
    seasonNumber: integer('season_number').notNull(),
    episodeNumber: integer('episode_number').notNull(),
    watchedAt: ts('watched_at').notNull().defaultNow(),
  },
  (t) => [
    unique('episode_progress_user_tv_season_episode_unique').on(
      t.userId,
      t.tvId,
      t.seasonNumber,
      t.episodeNumber,
    ),
    index('episode_progress_user_id_idx').on(t.userId),
  ],
);

export const ratings = pgTable(
  'ratings',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    mediaType: text('media_type').notNull(),
    tmdbId: integer('tmdb_id').notNull(),
    score: integer('score').notNull(),
    ratedAt: ts('rated_at').notNull().defaultNow(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [
    unique('ratings_user_media_tmdb_unique').on(t.userId, t.mediaType, t.tmdbId),
    check('ratings_media_type_check', sql`${t.mediaType} in ('movie', 'tv')`),
    check('ratings_score_check', sql`${t.score} between 1 and 10`),
    index('ratings_user_id_idx').on(t.userId),
  ],
);

/**
 * Removal markers (Phase 4): when a row is removed, its key and the time of the removal stay here for 60 days, so a
 * write done earlier on an offline device and arriving later never brings the row back. Items and ratings leave
 * the season and episode empty; a mark (`kind = 'mark'`) is a TV episode with both filled in. Never read as library.
 */
export const libraryRemovals = pgTable(
  'library_removals',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    mediaType: text('media_type').notNull(),
    tmdbId: integer('tmdb_id').notNull(),
    seasonNumber: integer('season_number'),
    episodeNumber: integer('episode_number'),
    removedAt: ts('removed_at').notNull(),
  },
  (t) => [
    unique('library_removals_key_unique')
      .on(t.userId, t.kind, t.mediaType, t.tmdbId, t.seasonNumber, t.episodeNumber)
      .nullsNotDistinct(),
    check('library_removals_kind_check', sql`${t.kind} in ('item', 'rating', 'mark')`),
  ],
);

/** Commands already applied, by the id the offline queue gives each one, so a resent command never applies twice. */
export const appliedCommands = pgTable(
  'applied_commands',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    commandId: text('command_id').notNull(),
    appliedAt: ts('applied_at').notNull(),
  },
  (t) => [primaryKey({ name: 'applied_commands_pkey', columns: [t.userId, t.commandId] })],
);
