// Client-safe person helpers, shared by server pages, client search and share images.

const DEPARTMENTS: Record<string, string> = {
  Acting: 'Atuação',
  Directing: 'Direção',
  Writing: 'Roteiro',
  Production: 'Produção',
  Sound: 'Som',
  Camera: 'Fotografia',
  Editing: 'Edição',
  Art: 'Direção de arte',
  'Costume & Make-Up': 'Figurino e maquiagem',
  'Visual Effects': 'Efeitos visuais',
  Lighting: 'Iluminação',
  Crew: 'Equipe',
};

/** pt-BR label for a TMDb department ("Acting" -> "Atuação"); unknown values pass through. */
export function departmentLabel(d: string): string {
  return DEPARTMENTS[d] ?? d;
}

/** Up to two initials, uppercased ("Brad Pitt" -> "BP"). */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}
