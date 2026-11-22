import { z } from 'zod';
import type { LibraryCommand } from './commands';
import { LIBRARY_LIMITS, PG_INT_MAX } from './limits';
import {
  episodeNumber,
  episodeSchema,
  id,
  isoDate,
  itemSchema,
  mediaType,
  ratingSchema,
  seasonNumber,
  snapshotSchema,
} from './schema';

/**
 * Zod for a LibraryCommand arriving from a client (POST /api/library/commands). Unknown fields are stripped. Sizes
 * are capped so one command can never build more rows than a user may keep.
 */

const refSchema = z.object({ mediaType, tmdbId: id });
const episodeRef = z.object({ seasonNumber, episodeNumber: z.number().int().min(0).max(PG_INT_MAX) });
const markRef = z.object({ seasonNumber, episodeNumber });

const fingerprintSchema = z.object({
  itemUpdatedAt: isoDate.nullable(),
  ratingUpdatedAt: isoDate.nullable(),
  markCount: z.number().int().min(0).max(LIBRARY_LIMITS.marks),
  latestMarkAt: isoDate.nullable(),
});

const progressSchema = z
  .object({
    tvId: id,
    ended: z.boolean(),
    seasons: z
      .array(z.object({ seasonNumber, episodeCount: z.number().int().min(0).max(LIBRARY_LIMITS.marks) }))
      .max(1_000),
    lastAired: episodeRef.nullable(),
    nextToAir: episodeRef.extend({ airDate: z.string().max(40).nullable() }).nullable(),
  })
  // `setStatus` to watched marks every aired episode: never more than a user may keep.
  .refine((p) => p.seasons.reduce((sum, s) => sum + s.episodeCount, 0) <= LIBRARY_LIMITS.marks);

const commandSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('setStatus'),
    ref: refSchema,
    status: z.enum(['want', 'watching', 'watched']),
    snapshot: snapshotSchema,
    progress: progressSchema.optional(),
  }),
  z.object({ type: z.literal('remove'), ref: refSchema }),
  z.object({ type: z.literal('rate'), ref: refSchema, score: z.number().int().min(1).max(10), snapshot: snapshotSchema }),
  z.object({ type: z.literal('unrate'), ref: refSchema }),
  z.object({
    type: z.literal('setEpisodes'),
    tvId: id,
    marks: z.array(markRef).max(LIBRARY_LIMITS.marksPerSetEpisodes),
    watched: z.boolean(),
    snapshot: snapshotSchema,
    progress: progressSchema,
  }),
  z.object({
    type: z.literal('restore'),
    ref: refSchema,
    item: itemSchema.nullable(),
    rating: ratingSchema.nullable(),
    marks: z.array(episodeSchema).max(LIBRARY_LIMITS.marks),
    expected: fingerprintSchema.optional(),
  }),
]);

type ParsedCommand = z.infer<typeof commandSchema>;

const sameTitle = (a: { mediaType: string; tmdbId: number }, b: { mediaType: string; tmdbId: number }) =>
  a.mediaType === b.mediaType && a.tmdbId === b.tmdbId;

/** Rules the reducer would otherwise throw on, or that would let a restore write rows of another title. */
function consistent(command: ParsedCommand): boolean {
  switch (command.type) {
    case 'setStatus':
      return !(command.ref.mediaType === 'movie' && command.status === 'watching');
    case 'restore': {
      const { ref, item, rating, marks } = command;
      if (item && !sameTitle(item, ref)) return false;
      if (rating && !sameTitle(rating, ref)) return false;
      return marks.every((m) => ref.mediaType === 'tv' && m.tvId === ref.tmdbId);
    }
    default:
      return true;
  }
}

/** The command when it is valid, or null. */
export function parseCommand(raw: unknown): LibraryCommand | null {
  const result = commandSchema.safeParse(raw);
  if (!result.success || !consistent(result.data)) return null;
  return result.data satisfies LibraryCommand;
}

/**
 * What POST /api/library/commands receives: `{ command, at?, commandId? }`. A command from the offline queue carries
 * the time the action was done on the device (`at`) and the id the queue gave it (`commandId`, a uuid), so a resent
 * command never applies twice. Without them it is a command as before.
 */
export type CommandEnvelope = { command: LibraryCommand; at?: string; commandId?: string };

const envelopeSchema = z.object({
  command: z.unknown(),
  // ISO 8601 with an offset; 40 characters hold any real one, fractions included.
  at: z.string().max(40).pipe(isoDate).optional(),
  commandId: z.uuid().optional(),
});

/** The envelope when the command and both optional fields are valid, or null. */
export function parseEnvelope(raw: unknown): CommandEnvelope | null {
  const result = envelopeSchema.safeParse(raw);
  if (!result.success) return null;
  const command = parseCommand(result.data.command);
  if (!command) return null;
  const { at, commandId } = result.data;
  return { command, ...(at === undefined ? {} : { at }), ...(commandId === undefined ? {} : { commandId }) };
}
