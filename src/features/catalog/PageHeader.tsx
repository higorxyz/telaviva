import { AccentTitle } from '@/ui/AccentTitle';

export function PageHeader({
  title,
  description,
}: {
  title: { lead: string; accent?: string };
  description?: string;
}) {
  return (
    <header className="mb-10">
      <AccentTitle as="h1" lead={title.lead} accent={title.accent} className="text-5xl leading-[1.02] md:text-7xl" />
      {description ? <p className="mt-3 max-w-2xl font-sans text-lg text-ivory-muted">{description}</p> : null}
    </header>
  );
}
