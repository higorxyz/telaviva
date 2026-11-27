import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PopoverSheet } from './PopoverSheet';

const mq = {
  matches: true,
  onChange: () => {},
};

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button">Fora</button>
      <PopoverSheet
        open={open}
        onOpenChange={setOpen}
        title="Painel"
        trigger={(props) => (
          <button type="button" {...props}>
            Abrir
          </button>
        )}
      >
        {({ close }) => (
          <div>
            <button type="button">Primeiro</button>
            <button type="button" onClick={close}>
              Escolher
            </button>
          </div>
        )}
      </PopoverSheet>
    </div>
  );
}

const trigger = () => screen.getByRole('button', { name: 'Abrir' });
const panel = () => document.getElementById(trigger().getAttribute('aria-controls')!) as HTMLDialogElement;

describe('PopoverSheet', () => {
  beforeAll(() => {
    HTMLDialogElement.prototype.show = function show() {
      this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.close = function close() {
      if (!this.hasAttribute('open')) return;
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    };
  });
  beforeEach(() => {
    mq.matches = true;
    vi.stubGlobal('matchMedia', () => ({
      matches: mq.matches,
      addEventListener: (_t: string, cb: () => void) => (mq.onChange = cb),
      removeEventListener: () => {},
    }));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('opens with focus inside, announces itself on the trigger and returns focus on a pick', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(trigger()).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    await user.click(trigger());
    expect(panel()).toHaveAttribute('open');
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    expect(within(panel()).getByRole('heading', { name: 'Painel' })).toBeInTheDocument();
    expect(within(panel()).getByRole('button', { name: 'Primeiro' })).toHaveFocus();
    await user.click(within(panel()).getByRole('button', { name: 'Escolher' }));
    expect(panel()).not.toHaveAttribute('open');
    expect(trigger()).toHaveFocus();
  });

  it('closes on Esc and on the close button, returning focus to the trigger', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(trigger());
    await user.keyboard('{Escape}');
    expect(panel()).not.toHaveAttribute('open');
    expect(trigger()).toHaveFocus();

    await user.click(trigger());
    await user.click(within(panel()).getByRole('button', { name: 'Fechar Painel' }));
    expect(panel()).not.toHaveAttribute('open');
    expect(trigger()).toHaveFocus();
  });

  it('stays open when the close event of an earlier closing comes after it opened again', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(trigger());
    // The element closes at once; its close event is a queued task that the next press can overtake.
    const late: Array<() => void> = [];
    vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function close(this: HTMLDialogElement) {
      this.removeAttribute('open');
      late.push(() => this.dispatchEvent(new Event('close')));
    });
    await user.keyboard('{Escape}');
    expect(panel()).not.toHaveAttribute('open');
    await user.click(trigger());
    expect(panel()).toHaveAttribute('open');
    act(() => late.forEach((deliver) => deliver()));
    expect(panel()).toHaveAttribute('open');
    expect(within(panel()).getByRole('button', { name: 'Primeiro' })).toHaveFocus();
  });

  it('mobile: a tap right after the native Esc (its close event still queued) opens the sheet again', async () => {
    mq.matches = false;
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(trigger());
    const late: Array<() => void> = [];
    vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function close(this: HTMLDialogElement) {
      this.removeAttribute('open');
      late.push(() => this.dispatchEvent(new Event('close')));
    });
    act(() => panel().close()); // what Esc does on a native modal dialog
    expect(panel()).not.toHaveAttribute('open');
    await user.click(trigger());
    expect(panel()).toHaveAttribute('open');
    act(() => late.forEach((deliver) => deliver()));
    expect(panel()).toHaveAttribute('open');
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
  });

  it('closes on an outside click without pulling focus back', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(trigger());
    await user.click(screen.getByRole('button', { name: 'Fora' }));
    expect(panel()).not.toHaveAttribute('open');
    expect(trigger()).not.toHaveFocus();
  });

  it('mobile: opens as a sheet, closes with the native cancel and when the viewport becomes wide', async () => {
    mq.matches = false;
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(trigger());
    const sheet = panel();
    expect(sheet).toHaveAttribute('open');
    act(() => sheet.close()); // what Esc does on a native modal dialog
    expect(sheet).not.toHaveAttribute('open');
    expect(trigger()).toHaveFocus();

    await user.click(trigger());
    mq.matches = true;
    act(() => mq.onChange());
    expect(sheet).not.toHaveAttribute('open');
  });
});
