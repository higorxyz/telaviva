import { cn } from '@/lib/cn';

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('font-display text-2xl text-ivory', className)}>
      Tela<em className="text-amber">viva</em>
    </span>
  );
}
