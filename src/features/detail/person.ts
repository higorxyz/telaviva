import { formatYear } from '@/lib/format';
import type { PersonCredit } from '@/features/tmdb/types';

export type CreditFilter = 'all' | 'acting' | 'crew';
export type YearGroup = { year: string; items: PersonCredit[] };

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
    if (seen.has(key(c))) continue;
    seen.add(key(c));
    if (c.posterPath) unique.push(c);
  }
  return unique.sort((a, b) => score(b) - score(a)).slice(0, limit);
}

/** One entry per title; repeated credits (cast + crew jobs) join their roles. */
function mergeByTitle(credits: PersonCredit[]): PersonCredit[] {
  const merged = new Map<string, PersonCredit>();
  for (const c of credits) {
    const prev = merged.get(key(c));
    if (!prev) {
      merged.set(key(c), c);
      continue;
    }
    const roles = [prev.role, c.role].flatMap((r) => r.split(', ')).filter(Boolean);
    merged.set(key(c), { ...prev, role: [...new Set(roles)].join(', ') });
  }
  return [...merged.values()];
}

export function filmography(credits: PersonCredit[]): YearGroup[] {
  const groups = new Map<string, PersonCredit[]>();
  for (const c of mergeByTitle(credits)) {
    const year = formatYear(c.releaseDate) ?? NO_DATE;
    groups.set(year, [...(groups.get(year) ?? []), c]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === NO_DATE ? 1 : b === NO_DATE ? -1 : Number(b) - Number(a)))
    .map(([year, items]) => ({
      year,
      items: items.sort((a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? '') || b.popularity - a.popularity),
    }));
}

export function splitCredits(credits: PersonCredit[]): Record<CreditFilter, PersonCredit[]> {
  return {
    all: credits,
    acting: credits.filter((c) => c.department === 'Acting'),
    crew: credits.filter((c) => c.department !== 'Acting'),
  };
}
