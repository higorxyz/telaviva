import { formatYear } from '@/lib/format';
import type { PersonCredit } from '@/features/tmdb/types';

export type CreditFilter = 'all' | 'acting' | 'crew';

const NO_DATE = 'Sem data';

const DEPARTMENTS: Record<string, string> = {
  Acting: 'Atuação',
  Directing: 'Direção',
  Writing: 'Roteiro',
  Production: 'Produção',
  Sound: 'Som',
  Camera: 'Fotografia',
  Editing: 'Edição',
  Art: 'Direção de arte',
  'Costume & Make-Up': 'Figurino e maquiagem',
  'Visual Effects': 'Efeitos visuais',
  Crew: 'Equipe',
};

export function departmentLabel(d: string): string {
  return DEPARTMENTS[d] ?? d;
}

/** Whole years between the birthday and the death date (or `today`). Dates are `YYYY-MM-DD`. */
export function age(birthday: string, deathday: string | null, today: Date = new Date()): number {
  const [by = 0, bm = 0, bd = 0] = birthday.split('-').map(Number);
  const end = deathday
    ? deathday.split('-').map(Number)
    : [today.getUTCFullYear(), today.getUTCMonth() + 1, today.getUTCDate()];
  const [ey = 0, em = 0, ed = 0] = end;
  return ey - by - (em < bm || (em === bm && ed < bd) ? 1 : 0);
}

const key = (c: PersonCredit) => `${c.mediaType}:${c.id}`;
const score = (c: PersonCredit) => c.voteCount * 0.6 + c.popularity * 0.4;

export function knownFor(credits: PersonCredit[], limit = 12): PersonCredit[] {
  const seen = new Set<string>();
  const unique: PersonCredit[] = [];
  for (const c of credits) {
    if (seen.has(key(c)) || !c.posterPath) continue;
    seen.add(key(c));
    unique.push(c);
  }
  return unique.sort((a, b) => score(b) - score(a)).slice(0, limit);
}

/** Slim, serializable row: one per title, with the cast and crew roles kept apart for the client filter. */
export type FilmRow = {
  key: string;
  id: number;
  mediaType: 'movie' | 'tv';
  title: string;
  releaseDate: string | null;
  posterPath: string | null;
  popularity: number;
  castRoles: string[] | null;
  crewRoles: string[] | null;
};
export type FilmEntry = FilmRow & { role: string };
export type YearGroup = { year: string; items: FilmEntry[] };

const addRole = (roles: string[] | null, role: string) => {
  const list = roles ?? [];
  return role && !list.includes(role) ? [...list, role] : list;
};

/** Merges repeated credits of a title (cast + crew jobs) into one row. */
export function toFilmRows(credits: PersonCredit[]): FilmRow[] {
  const rows = new Map<string, FilmRow>();
  for (const c of credits) {
    const row = rows.get(key(c)) ?? {
      key: key(c),
      id: c.id,
      mediaType: c.mediaType,
      title: c.title,
      releaseDate: c.releaseDate,
      posterPath: c.posterPath,
      popularity: c.popularity,
      castRoles: null,
      crewRoles: null,
    };
    if (c.department === 'Acting') row.castRoles = addRole(row.castRoles, c.role);
    else row.crewRoles = addRole(row.crewRoles, c.role);
    rows.set(row.key, row);
  }
  return [...rows.values()];
}

/** Year-grouped view of the rows for a filter; roles shown are only those of that view. */
export function groupRows(rows: FilmRow[], filter: CreditFilter = 'all'): YearGroup[] {
  const groups = new Map<string, FilmEntry[]>();
  for (const r of rows) {
    const roles = [...(filter === 'crew' ? [] : (r.castRoles ?? [])), ...(filter === 'acting' ? [] : (r.crewRoles ?? []))];
    const included = filter === 'all' || (filter === 'acting' ? r.castRoles : r.crewRoles) !== null;
    if (!included) continue;
    const year = formatYear(r.releaseDate) ?? NO_DATE;
    groups.set(year, [...(groups.get(year) ?? []), { ...r, role: roles.join(', ') }]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === NO_DATE ? 1 : b === NO_DATE ? -1 : Number(b) - Number(a)))
    .map(([year, items]) => ({
      year,
      items: items.sort((a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? '') || b.popularity - a.popularity),
    }));
}

export function filmography(credits: PersonCredit[]): YearGroup[] {
  return groupRows(toFilmRows(credits));
}
