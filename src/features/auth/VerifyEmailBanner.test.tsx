import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthApi } from './auth-context';
import { sessionUser } from './test-auth';
import { VerifyEmailBanner } from './VerifyEmailBanner';

const state = vi.hoisted(() => ({ api: {} as Partial<AuthApi> }));
vi.mock('./useAuth', () => ({ useAuth: () => state.api }));

const sendVerification = vi.fn<() => Promise<void>>();
const refresh = vi.fn<() => Promise<void>>();

const as = (status: AuthApi['status'], emailVerified = false) => {
  state.api = {
    status,
    user: status === 'signed-in' ? sessionUser('a', { emailVerified }) : null,
    sendVerification,
    refresh,
  };
};

const flush = () => act(async () => {});
const TEXT = 'Confirme seu e-mail para proteger sua conta.';

describe('VerifyEmailBanner', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sendVerification.mockReset().mockResolvedValue();
    refresh.mockReset().mockResolvedValue();
    window.sessionStorage.clear();
    as('signed-in');
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it.each([
    ['loading', false],
    ['guest', false],
    ['disabled', false],
    ['signed-in', true],
  ] as const)('is hidden for %s (verified: %s)', (status, verified) => {
    as(status, verified);
    const { container } = render(<VerifyEmailBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the notice to a signed-in user with an unverified e-mail', () => {
    render(<VerifyEmailBanner />);
    expect(screen.getByText(TEXT)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reenviar e-mail' })).toBeInTheDocument();
  });

  it('resends, says so, and stays disabled for 60 s with focus kept', async () => {
    render(<VerifyEmailBanner />);
    const button = screen.getByRole('button', { name: 'Reenviar e-mail' });
    button.focus();
    fireEvent.click(button);
    await flush();
    expect(sendVerification).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent('E-mail enviado.');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveFocus();

    fireEvent.click(button);
    expect(sendVerification).toHaveBeenCalledTimes(1);

    await act(() => vi.advanceTimersByTimeAsync(59_000));
    expect(button).toHaveAttribute('aria-disabled', 'true');
    await act(() => vi.advanceTimersByTimeAsync(1_000));
    expect(button).toHaveAttribute('aria-disabled', 'false');
    fireEvent.click(button);
    await flush();
    expect(sendVerification).toHaveBeenCalledTimes(2);
  });

  it('shows the auth error copy when the resend fails', async () => {
    sendVerification.mockRejectedValue({ code: 'auth/too-many-requests' });
    render(<VerifyEmailBanner />);
    fireEvent.click(screen.getByRole('button', { name: 'Reenviar e-mail' }));
    await flush();
    expect(screen.getByRole('status')).toHaveTextContent('Muitas tentativas. Espere um pouco e tente de novo.');
  });

  it('can be dismissed for the session', () => {
    const { unmount } = render(<VerifyEmailBanner />);
    fireEvent.click(screen.getByRole('button', { name: 'Fechar aviso' }));
    expect(screen.queryByText(TEXT)).toBeNull();
    unmount();
    render(<VerifyEmailBanner />);
    expect(screen.queryByText(TEXT)).toBeNull();
  });

  describe('freshness', () => {
    it('refreshes on mount, and on focus or visibility at most once per 30 s', async () => {
      render(<VerifyEmailBanner />);
      await flush();
      expect(refresh).toHaveBeenCalledTimes(1);

      await act(() => vi.advanceTimersByTimeAsync(10_000));
      act(() => {
        window.dispatchEvent(new Event('focus'));
        document.dispatchEvent(new Event('visibilitychange'));
      });
      expect(refresh).toHaveBeenCalledTimes(1);

      await act(() => vi.advanceTimersByTimeAsync(20_000));
      act(() => {
        window.dispatchEvent(new Event('focus'));
      });
      expect(refresh).toHaveBeenCalledTimes(2);

      await act(() => vi.advanceTimersByTimeAsync(30_000));
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      expect(refresh).toHaveBeenCalledTimes(3);
    });

    it('ignores a visibility change to hidden', async () => {
      render(<VerifyEmailBanner />);
      await flush();
      await act(() => vi.advanceTimersByTimeAsync(31_000));
      vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      expect(refresh).toHaveBeenCalledTimes(1);
    });

    it('survives a failed refresh and goes away once the e-mail is verified', async () => {
      refresh.mockRejectedValueOnce(new Error('offline'));
      const { container, rerender } = render(<VerifyEmailBanner />);
      await flush();
      expect(screen.getByText(TEXT)).toBeInTheDocument();
      as('signed-in', true);
      rerender(<VerifyEmailBanner />);
      expect(container).toBeEmptyDOMElement();
    });
  });
});
