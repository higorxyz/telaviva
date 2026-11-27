import type { ReactNode } from 'react';

export function FactsList({ facts }: { facts: Array<{ label: string; value: ReactNode }> }) {
  return (
    <dl className="grid gap-x-8 gap-y-4 font-sans sm:grid-cols-2">
      {facts.map((fact) => (
        <div key={fact.label} className="border-b border-ink-700 pb-3">
          <dt className="text-xs font-medium tracking-[0.18em] text-ivory-muted uppercase">{fact.label}</dt>
          <dd className="mt-1 text-ivory">{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}
