import { describe, expect, it } from 'vitest';
import type { PersonDetails } from '@/features/tmdb/types';
import { personFacts } from './facts';

const base: PersonDetails = {
  id: 1,
  name: 'Fulano',
  biography: '',
  birthday: '1963-12-18',
  deathday: null,
  placeOfBirth: 'Shawnee, EUA',
  profilePath: null,
  knownForDepartment: 'Directing',
  alsoKnownAs: ['A', 'B', 'C', 'D'],
  credits: [],
  images: [],
};
const get = (facts: ReturnType<typeof personFacts>, label: string) => facts.find((f) => f.label === label)?.value;

describe('personFacts', () => {
  it('mostra a idade junto da data de nascimento e limita os apelidos a três', () => {
    const facts = personFacts(base, { now: 62, atDeath: null });
    expect(get(facts, 'Nascimento')).toMatch(/dez.* 1963 \(62 anos\)/);
    expect(get(facts, 'Falecimento')).toBeUndefined();
    expect(get(facts, 'Área')).toBe('Direção');
    expect(get(facts, 'Também conhecido como')).toBe('A, B, C');
  });

  it('mostra o falecimento com a idade na morte e omite a idade atual', () => {
    const facts = personFacts({ ...base, birthday: '1950-01-01', deathday: '2000-06-01', alsoKnownAs: [] }, { now: null, atDeath: 50 });
    expect(get(facts, 'Nascimento')).not.toMatch(/anos/);
    expect(get(facts, 'Falecimento')).toMatch(/2000 \(50 anos\)/);
    expect(get(facts, 'Também conhecido como')).toBeUndefined();
  });
});
