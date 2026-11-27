import { ImageResponse } from 'next/og';
import { formatRating, splitAccent } from '@/lib/format';
import { TOKENS } from '@/ui/tokens';
import { OG_FONTS } from './og-assets';

export const OG_SIZE = { width: 1200, height: 630 } as const;

export interface OgCardProps {
  title: string;
  subtitle: string;
  rating: number | null;
  backdrop: string | null;
  poster: string | null;
}

const display = { fontFamily: 'Instrument Serif' } as const;
const RING = 92;
const RING_STROKE = 8;

function Wordmark({ size }: { size: number }) {
  return (
    <div style={{ display: 'flex', ...display, fontSize: size, color: TOKENS.ivory }}>
      Tela
      <span style={{ fontStyle: 'italic', color: TOKENS.amber }}>viva</span>
    </div>
  );
}

function Ring({ value }: { value: number }) {
  const r = (RING - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * r;
  const filled = (Math.min(10, value) / 10) * circumference;
  return (
    <div style={{ display: 'flex', position: 'relative', width: RING, height: RING }}>
      <svg width={RING} height={RING} viewBox={`0 0 ${RING} ${RING}`}>
        <circle cx={RING / 2} cy={RING / 2} r={r} fill={TOKENS.ink900} stroke={TOKENS.ink800} strokeWidth={RING_STROKE} />
        <circle
          cx={RING / 2}
          cy={RING / 2}
          r={r}
          fill="none"
          stroke={TOKENS.amber}
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
          transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
        />
      </svg>
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          top: 0,
          left: 0,
          width: RING,
          height: RING,
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Inter Tight',
          fontSize: 30,
          color: TOKENS.ivory,
        }}
      >
        {formatRating(value)}
      </div>
    </div>
  );
}

function Title({ text }: { text: string }) {
  const { lead, accent } = splitAccent(text);
  const fontSize = text.length > 42 ? 56 : text.length > 22 ? 72 : 92;
  const words = (s: string) => s.split(/\s+/).filter(Boolean);
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        columnGap: fontSize * 0.25,
        ...display,
        fontSize,
        lineHeight: 1.05,
        color: TOKENS.ivory,
      }}
    >
      {words(lead).map((w, i) => (
        <span key={`l${i}`}>{w}</span>
      ))}
      {accent
        ? words(accent).map((w, i) => (
            <span key={`a${i}`} style={{ fontStyle: 'italic', color: TOKENS.amber }}>
              {w}
            </span>
          ))
        : null}
    </div>
  );
}

const fade = `linear-gradient(90deg, ${TOKENS.ink950} 0%, ${TOKENS.ink950} 45%, transparent 90%)`;

/** 1200x630 share card in the "Sala Escura" identity. Images must already be data URIs or absolute URLs. */
export function ogCard({ title, subtitle, rating, backdrop, poster }: OgCardProps): ImageResponse {
  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: '100%', height: '100%', position: 'relative', background: TOKENS.ink950 }}>
        {backdrop ? (
          <img src={backdrop} alt="" width={780} height={630} style={{ position: 'absolute', right: 0, top: 0, objectFit: 'cover' }} />
        ) : null}
        <div style={{ display: 'flex', position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: fade }} />
        <div style={{ display: 'flex', position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', padding: 56, gap: 44, alignItems: 'center' }}>
          {poster ? (
            <img
              src={poster}
              alt=""
              width={260}
              height={390}
              style={{ borderRadius: 14, objectFit: 'cover', border: `2px solid ${TOKENS.ink800}` }}
            />
          ) : null}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 24 }}>
            <Title text={title} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, fontFamily: 'Inter Tight', fontSize: 30, color: TOKENS.ivoryMuted }}>
              {rating !== null && rating > 0 ? <Ring value={rating} /> : null}
              <span>{subtitle}</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', position: 'absolute', left: 56, bottom: 40 }}>
          <Wordmark size={40} />
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: OG_FONTS },
  );
}

/** Generic branded card, used whenever a title cannot be loaded. */
export function brandCard(): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          background: TOKENS.ink950,
        }}
      >
        <Wordmark size={190} />
        <div style={{ display: 'flex', fontFamily: 'Inter Tight', fontSize: 38, color: TOKENS.ivoryMuted }}>Filmes e séries</div>
      </div>
    ),
    { ...OG_SIZE, fonts: OG_FONTS },
  );
}
