import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BackButton } from './BackButton';
import { markInAppNavigation, resetInAppHistoryForTests } from './in-app-history';
import { PersonHero } from './PersonHero';

const router = vi.hoisted(() => ({ back: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

beforeEach(() => {
  router.back.mockClear();
  router.push.mockClear();
  resetInAppHistoryForTests();
  sessionStorage.clear();
});

describe('BackButton', () => {
  it('goes back when the user arrived from inside the app', async () => {
    markInAppNavigation();
    render(<BackButton fallbackHref="/filmes" />);
    await userEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.push).not.toHaveBeenCalled();
  });

  it('trusts the sessionStorage flag after a reload', async () => {
    sessionStorage.setItem('tv:in-app-nav', '1');
    render(<BackButton fallbackHref="/filmes" />);
    await userEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['filme', '/filmes'],
    ['serie', '/series'],
    ['pessoa', '/'],
  ])('without in-app history on %s it navigates to %s once', async (_kind, href) => {
    render(<BackButton fallbackHref={href} />);
    await userEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(router.push).toHaveBeenCalledExactlyOnceWith(href);
    expect(router.back).not.toHaveBeenCalled();
  });

  it('falls back when sessionStorage throws', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    render(<BackButton fallbackHref="/series" />);
    await userEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(router.push).toHaveBeenCalledWith('/series');
    vi.restoreAllMocks();
  });

  it('is rendered by the person hero with the home fallback', async () => {
    render(<PersonHero person={{ name: 'Brad Pitt', profilePath: null } as never}>x</PersonHero>);
    await userEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(router.push).toHaveBeenCalledWith('/');
  });
});
