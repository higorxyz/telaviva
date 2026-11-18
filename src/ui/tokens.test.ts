import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TOKENS } from './tokens';

const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');
const cssName = (key: string) => key.replace(/([a-z])(\d)/g, '$1-$2').replace(/([A-Z])/g, '-$1').toLowerCase();

describe('TOKENS', () => {
  it.each(Object.entries(TOKENS))('%s matches the @theme value in globals.css', (key, hex) => {
    const match = new RegExp(`--color-${cssName(key)}:\\s*(#[0-9a-f]{6});`).exec(css);
    expect(match?.[1]).toBe(hex);
  });
});
