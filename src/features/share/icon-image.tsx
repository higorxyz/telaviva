import { ImageResponse } from 'next/og';
import { TOKENS } from '@/ui/tokens';
import { OG_FONTS } from './og-assets';

/**
 * Square "T" monogram: amber Instrument Serif on ink-950.
 * `maskable` shrinks the glyph so it stays inside the central 80% safe zone that launchers may crop to.
 */
export function iconImage(px: number, maskable = false): ImageResponse {
  const fontSize = Math.round(px * (maskable ? 0.52 : 0.72));
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          background: TOKENS.ink950,
          color: TOKENS.amber,
          fontFamily: 'Instrument Serif',
          fontSize,
          lineHeight: 1,
          paddingTop: Math.round(fontSize * 0.06),
        }}
      >
        T
      </div>
    ),
    { width: px, height: px, fonts: OG_FONTS.filter((f) => f.name === 'Instrument Serif' && f.style === 'normal') },
  );
}
