/** Human-readable migration target that never includes credentials. */
export function describeTarget(
  driver: 'neon' | 'pglite',
  databaseUrl: string | null,
  pgliteDir: string | null,
): string {
  if (driver === 'pglite') return `PGlite (${pgliteDir ?? 'memória'})`;
  if (!databaseUrl) return 'Neon (não configurado)';
  try {
    return `Neon (${new URL(databaseUrl).host})`;
  } catch {
    return 'Neon (URL inválida)';
  }
}
