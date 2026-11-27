// Runs vitest from the canonical cwd. On Windows a lowercase-drive cwd (c:\...) makes vite
// resolve the same module under two spellings and load a second vitest instance, which
// breaks every test file. realpathSync.native restores the real casing; no-op elsewhere.
import { spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const cwd = realpathSync.native(process.cwd());
const vitestDir = dirname(createRequire(import.meta.url).resolve('vitest/package.json'));
const vitestCli = realpathSync.native(join(vitestDir, 'vitest.mjs'));
const { status } = spawnSync(process.execPath, [vitestCli, ...process.argv.slice(2)], {
  cwd,
  stdio: 'inherit',
});
process.exit(status ?? 1);
