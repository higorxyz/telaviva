import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const FONT_DIR = join(process.cwd(), 'src/assets/fonts');
const load = (file: string) => readFile(join(FONT_DIR, file));

// Static weights only: satori cannot handle variable fonts. Read once per server instance.
const [serif, serifItalic, sans] = await Promise.all([
  load('InstrumentSerif-Regular.ttf'),
  load('InstrumentSerif-Italic.ttf'),
  load('InterTight-Medium.ttf'),
]);

export const OG_FONTS = [
  { name: 'Instrument Serif', data: serif, style: 'normal' as const, weight: 400 as const },
  { name: 'Instrument Serif', data: serifItalic, style: 'italic' as const, weight: 400 as const },
  { name: 'Inter Tight', data: sans, style: 'normal' as const, weight: 500 as const },
];

/** Fetches a remote image as a data URI so a slow or broken CDN can never fail the render; null on any problem. */
export async function toDataUri(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') ?? 'image/jpeg';
    return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`;
  } catch {
    return null;
  }
}
