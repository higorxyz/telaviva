import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PersonCard } from '@/features/search/PersonCard';
import { groupResults } from '@/features/search/palette-options';
import { departmentLabel, initials } from './people';

describe('departmentLabel', () => {
  it('traduz departamentos do TMDb e mantém o desconhecido', () => {
    expect(departmentLabel('Acting')).toBe('Atuação');
    expect(departmentLabel('Directing')).toBe('Direção');
    expect(departmentLabel('Weird')).toBe('Weird');
  });
});

describe('initials', () => {
  it('pega até duas iniciais', () => {
    expect(initials('Brad Pitt')).toBe('BP');
    expect(initials('  ana  maria  silva ')).toBe('AM');
    expect(initials('Cher')).toBe('C');
  });
});

describe('rótulos em pt-BR na busca', () => {
  const person = { id: 1, name: 'Keanu Reeves', profilePath: null, knownForDepartment: 'Acting' };
  it('PersonCard mostra "Atuação", não "Acting"', () => {
    render(<PersonCard person={person} />);
    expect(screen.getByText('Atuação')).toBeInTheDocument();
    expect(screen.queryByText('Acting')).toBeNull();
  });
  it('a paleta usa o rótulo traduzido como dica', () => {
    const [group] = groupResults([{ ...person, mediaType: 'person' }], 'p');
    expect(group!.options[0]!.hint).toBe('Atuação');
  });
});
