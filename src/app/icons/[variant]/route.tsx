import { notFound } from 'next/navigation';
import { iconImage } from '@/features/share/icon-image';

const VARIANTS = {
  '192': { px: 192, maskable: false },
  '512': { px: 512, maskable: false },
  maskable: { px: 512, maskable: true },
} as const;

export function generateStaticParams() {
  return Object.keys(VARIANTS).map((variant) => ({ variant }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ variant: string }> }) {
  const { variant } = await params;
  if (!Object.hasOwn(VARIANTS, variant)) notFound();
  const { px, maskable } = VARIANTS[variant as keyof typeof VARIANTS];
  return iconImage(px, maskable);
}
