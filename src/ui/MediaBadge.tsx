export function MediaBadge({ mediaType }: { mediaType: 'movie' | 'tv' }) {
  if (mediaType !== 'tv') return null;
  return (
    <span className="inline-flex items-center rounded-full bg-ink-950/80 px-2 py-0.5 font-sans text-[11px] font-medium tracking-wide text-ivory uppercase">
      Série
    </span>
  );
}
