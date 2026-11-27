/**
 * `npm run env:check [-- --target=local|preview|production] [-- --file=<path>]`
 *
 * Lists the environment variables a target is missing or has malformed, by name only (src/lib/check-env.ts), and
 * exits with 1 when there is any. By default it reads what `next dev` would see (`.env.local` and the other `.env*`
 * files, through @next/env, plus the shell). With `--file`, it reads only that file, e.g. the Production variables
 * pulled with `vercel env pull .env.production.local --environment=production` (delete that file afterwards).
 */
import { loadEnvConfig } from '@next/env';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { ENV_TARGETS, checkEnv, formatEnvReport, type EnvTarget } from '../src/lib/check-env';

function option(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function main() {
  const target = (option('target') ?? 'local') as EnvTarget;
  if (!ENV_TARGETS.includes(target)) {
    console.error(`Alvo desconhecido. Use --target=${ENV_TARGETS.join('|')}.`);
    process.exit(2);
  }
  const file = option('file');
  const source = file
    ? parseEnv(readFileSync(file, 'utf8'))
    : loadEnvConfig(process.cwd(), true, { info() {}, error() {} }).combinedEnv;
  const result = checkEnv(source, target);
  console.log(formatEnvReport(result, target));
  process.exit(result.missing.length + result.invalid.length > 0 ? 1 : 0);
}

main();
