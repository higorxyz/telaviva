const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'America/Sao_Paulo',
});

export function formatRating(v: number): string {
  return v.toFixed(1).replace('.', ',');
}

export function formatRuntime(min: number | null): string | null {
  if (!min || min <= 0) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}min`;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

export function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(`${iso}T12:00:00-03:00`);
  if (Number.isNaN(date.getTime())) return null;
  return dateFormatter.format(date);
}

export function formatYear(iso: string | null): string | null {
  if (!iso) return null;
  const year = iso.slice(0, 4);
  return /^\d{4}$/.test(year) ? year : null;
}

export function splitAccent(title: string): { lead: string; accent: string | null } {
  const trimmed = title.trim();
  const colon = trimmed.indexOf(':');
  if (colon !== -1) {
    const accent = trimmed.slice(colon + 1).trim();
    return { lead: trimmed.slice(0, colon + 1), accent: accent || null };
  }
  const words = trimmed.split(/\s+/);
  if (words.length < 2) return { lead: trimmed, accent: null };
  return { lead: words.slice(0, -1).join(' '), accent: words[words.length - 1] };
}
