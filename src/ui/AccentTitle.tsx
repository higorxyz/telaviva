import { cn } from '@/lib/cn';
import { splitAccent } from '@/lib/format';

type Props = {
  as?: 'h1' | 'h2' | 'h3';
  text?: string;
  lead?: string;
  accent?: string | null;
  className?: string;
};

export function AccentTitle({ as: Tag = 'h2', text, lead, accent, className }: Props) {
  const parts = text !== undefined ? splitAccent(text) : { lead: lead ?? '', accent: accent ?? null };
  return (
    <Tag className={cn('font-display text-balance text-ivory', className)}>
      {parts.lead}
      {parts.accent ? (
        <>
          {' '}
          <em className="text-amber italic">{parts.accent}</em>
        </>
      ) : null}
    </Tag>
  );
}
