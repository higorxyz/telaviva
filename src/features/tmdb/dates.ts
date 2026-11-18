const DAY_MS = 86_400_000;

const saoPauloDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** YYYY-MM-DD for today (São Paulo calendar) plus `offsetDays`. */
export function saoPauloIsoDate(offsetDays = 0, now: number = Date.now()): string {
  const [y, m, d] = saoPauloDate.format(now).split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d) + offsetDays * DAY_MS).toISOString().slice(0, 10);
}
