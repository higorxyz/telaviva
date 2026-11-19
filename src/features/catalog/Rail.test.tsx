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

  it('loads only the first priorityCount posters eagerly and never competes with the hero for fetch priority', () => {
    const { rerender } = render(<Rail id="r" title={title} items={five} />);
    expect(document.querySelectorAll('img[loading=eager]')).toHaveLength(0);
    rerender(<Rail id="r" title={title} items={five} priorityCount={2} />);
    expect(document.querySelectorAll('img[loading=eager]')).toHaveLength(2);
    expect(document.querySelectorAll('img[fetchpriority=high]')).toHaveLength(0);
  });

  it('states the rendered poster width in sizes so dense screens pick a sharper candidate', () => {
    render(<Rail id="r" title={title} items={five} />);
    const img = document.querySelector('img')!;
    expect(img.getAttribute('sizes')).toBe(
      '(min-width: 1536px) 224px, (min-width: 1280px) 208px, (min-width: 1024px) 192px, (min-width: 768px) 176px, (min-width: 640px) 160px, min(38vw, 176px)',
    );
    expect(img.closest('li')).toHaveClass('w-[38vw]', 'max-w-44', 'sm:w-40', 'md:w-44', 'lg:w-48', 'xl:w-52', '2xl:w-56');
  });

  it('has a single tab stop and moves focus with arrows, Home and End', () => {
    render(<Rail id="r" title={title} items={five} />);
    const links = screen.getAllByRole('link');
    expect(links.filter((a) => a.getAttribute('tabindex') === '0')).toHaveLength(1);
    links[0]!.focus();
    fireEvent.keyDown(links[0]!, { key: 'ArrowRight' });
    expect(links[1]).toHaveFocus();
    expect(links[1]).toHaveAttribute('tabindex', '0');
    expect(links[0]).toHaveAttribute('tabindex', '-1');
    fireEvent.keyDown(links[1]!, { key: 'End' });
    expect(links[4]).toHaveFocus();
    fireEvent.keyDown(links[4]!, { key: 'Home' });
    expect(links[0]).toHaveFocus();
    fireEvent.keyDown(links[0]!, { key: 'ArrowLeft' });
    expect(links[0]).toHaveFocus();
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
