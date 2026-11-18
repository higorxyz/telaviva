import type { ReactNode } from 'react';
import { AccentTitle } from '@/ui/AccentTitle';

export function DetailSection({
  id,
  title,
  children,
}: {
  id?: string;
  title: { lead: string; accent?: string };
  children: ReactNode;
}) {
  const headingId = `${id ?? title.lead.toLowerCase().replace(/\W+/g, '-')}-titulo`;
  return (
    <section id={id} aria-labelledby={headingId} className="scroll-mt-24">
      <AccentTitle as="h2" id={headingId} lead={title.lead} accent={title.accent} className="mb-4 text-2xl sm:text-3xl" />
      {children}
    </section>
  );
}
