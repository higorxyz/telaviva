'use client';

import { ErrorState } from '@/ui/ErrorState';

export default function Error({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="pt-24">
      <ErrorState onRetry={retry} />
    </div>
  );
}
