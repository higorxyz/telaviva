import { createEvent, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { movie } from '@/test/media';
import { Rail } from './Rail';

const five = [1, 2, 3, 4, 5].map((id) => movie({ id, title: `Filme ${id}` }));
const title = { lead: 'Séries', accent: 'em alta' };

describe('Rail', () => {
  it('is a labelled region', () => {
    render(<Rail id="r" title={title} href="/series/em-alta" items={five} />);
    expect(screen.getByRole('region', { name: 'Séries em alta' })).toBeInTheDocument();
  });

  it('links to the full list', () => {
    render(<Rail id="r" title={title} href="/series/em-alta" items={five} />);
    expect(screen.getByRole('link', { name: 'Ver tudo: Séries em alta' })).toHaveAttribute(
      'href',
      '/series/em-alta',
    );
  });

  it('renders one list item per title', () => {
    render(<Rail id="r" title={title} items={five} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
  });

  describe('drag', () => {
    function dragPast(list: HTMLElement) {
      fireEvent.pointerDown(list, { pointerType: 'mouse', button: 0, clientX: 100 });
      fireEvent.pointerMove(list, { pointerType: 'mouse', clientX: 80 });
    }
    const setup = () => {
      render(<Rail id="r" title={title} items={five} />);
      return { list: screen.getByRole('list'), link: screen.getByRole('link', { name: /Filme 1/ }) };
    };

    it('prevents native dragstart on the list', () => {
      const { list } = setup();
      const event = createEvent.dragStart(list);
      fireEvent(list, event);
      expect(event.defaultPrevented).toBe(true);
    });

    it('does not suppress keyboard-originated clicks after a drag left the list', () => {
      const { list, link } = setup();
      dragPast(list);
      fireEvent.pointerLeave(list);
      // Record the state after Rail's capture handler, then stop jsdom from navigating.
      let preventedByRail = true;
      link.addEventListener('click', (e) => {
        preventedByRail = e.defaultPrevented;
        e.preventDefault();
      });
      fireEvent.click(link, { detail: 0 });
      expect(preventedByRail).toBe(false);
    });

    it('suppresses the pointer click right after a drag', () => {
      const { list, link } = setup();
      dragPast(list);
      fireEvent.pointerUp(list, { pointerType: 'mouse' });
      const event = createEvent.click(link, { detail: 1 });
      fireEvent(link, event);
      expect(event.defaultPrevented).toBe(true);
    });
  });
});
