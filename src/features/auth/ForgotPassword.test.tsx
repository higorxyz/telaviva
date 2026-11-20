import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { server } from '@/test/server';
import { ForgotPassword } from './ForgotPassword';

const MESSAGE = 'Se esse e-mail estiver cadastrado e confirmado, você vai receber um link para criar uma nova senha.';
const endpoint = () => `${window.location.origin}/api/auth/password-reset`;

function setup(initialEmail = '') {
  const onBack = vi.fn();
  render(<ForgotPassword initialEmail={initialEmail} onBack={onBack} />);
  return { onBack, u: userEvent.setup() };
}

describe('ForgotPassword', () => {
  it('posts the e-mail and shows the fixed message, whatever the server knows', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(endpoint(), async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ message: MESSAGE });
      }),
    );
    const { u } = setup();
    await u.type(screen.getByLabelText('E-mail'), ' ana@exemplo.com ');
    await u.click(screen.getByRole('button', { name: 'Enviar link' }));
    await screen.findByText(MESSAGE);
    expect(screen.getByRole('status')).toHaveTextContent(MESSAGE);
    expect(bodies).toEqual([{ email: 'ana@exemplo.com' }]);
  });

  it('checks the e-mail format before asking the server', async () => {
    const hit = vi.fn();
    server.use(http.post(endpoint(), () => (hit(), HttpResponse.json({ message: MESSAGE }))));
    const { u } = setup('ana@');
    await u.click(screen.getByRole('button', { name: 'Enviar link' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Confira o e-mail digitado.');
    expect(hit).not.toHaveBeenCalled();
  });

  it('disables the button with a pending label while sending', async () => {
    let release!: () => void;
    server.use(
      http.post(endpoint(), async () => {
        await new Promise<void>((resolve) => (release = resolve));
        return HttpResponse.json({ message: MESSAGE });
      }),
    );
    const { u } = setup('ana@exemplo.com');
    await u.click(screen.getByRole('button', { name: 'Enviar link' }));
    expect(await screen.findByRole('button', { name: 'Enviando…' })).toBeDisabled();
    release();
    await screen.findByText(MESSAGE);
    expect(screen.getByRole('status')).toHaveTextContent(MESSAGE);
  });

  it('says so when the request is refused for too many attempts, or cannot leave', async () => {
    server.use(http.post(endpoint(), () => HttpResponse.json({ error: 'x' }, { status: 429 })));
    const { u } = setup('ana@exemplo.com');
    await u.click(screen.getByRole('button', { name: 'Enviar link' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Muitas tentativas. Espere um pouco e tente de novo.');
    server.use(http.post(endpoint(), () => HttpResponse.error()));
    await u.click(screen.getByRole('button', { name: 'Enviar link' }));
    expect(await screen.findByText('Sem conexão. Verifique sua internet.')).toHaveAttribute('role', 'alert');
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('goes back with "Voltar"', async () => {
    const { u, onBack } = setup();
    await u.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
