import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReauthStep } from './ReauthStep';

function renderStep(provider: 'password' | 'google', email: string | null = 'ana@exemplo.com') {
  return render(
    <ReauthStep provider={provider} email={email} password="" setPassword={vi.fn()} busy={false} onSubmit={vi.fn()} />,
  );
}

const usernameField = (container: HTMLElement) => container.querySelector('input[autocomplete="username"]');

describe('ReauthStep', () => {
  it("password: a hidden username field holds the account's e-mail, so a password manager can fill the password", () => {
    const { container } = renderStep('password');
    const username = usernameField(container);
    expect(username).not.toBeNull();
    expect(username).toHaveAttribute('type', 'email');
    expect(username).toHaveAttribute('hidden');
    expect(username).toHaveValue('ana@exemplo.com');
    expect(username).not.toBeVisible();
    // In the same form as the password, so the manager pairs them.
    expect(username?.closest('form')).toBe(screen.getByLabelText('Senha').closest('form'));
  });

  it('password: the password field asks for the current password and takes the focus', () => {
    renderStep('password');
    const password = screen.getByLabelText('Senha');
    expect(password).toHaveAttribute('autocomplete', 'current-password');
    expect(password).toHaveFocus();
  });

  it('the hidden username field is never announced nor reached with Tab', () => {
    const { container } = renderStep('password');
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(usernameField(container)).not.toBeVisible();
  });

  it('password without a known e-mail: no username field rather than an empty one', () => {
    const { container } = renderStep('password', null);
    expect(usernameField(container)).toBeNull();
    expect(screen.getByLabelText('Senha')).toBeInTheDocument();
  });

  it('Google: no form at all, only "Continuar com Google"', () => {
    const { container } = renderStep('google');
    expect(container.querySelector('form')).toBeNull();
    expect(usernameField(container)).toBeNull();
    expect(screen.getByRole('button', { name: 'Continuar com Google' })).toHaveFocus();
  });
});
