import { z } from 'zod';

const envSchema = z.object({
  TMDB_READ_TOKEN: z.string().min(1, 'TMDB_READ_TOKEN é obrigatório'),
  TMDB_API_BASE_URL: z.string().url().default('https://api.themoviedb.org/3'),
  SITE_URL: z.string().url().default('https://telaviva.vercel.app'),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse({
    TMDB_READ_TOKEN: source.TMDB_READ_TOKEN,
    TMDB_API_BASE_URL: source.TMDB_API_BASE_URL || undefined,
    SITE_URL: source.NEXT_PUBLIC_SITE_URL || undefined,
  });
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Variáveis de ambiente inválidas: ${details}`);
  }
  return result.data;
}
