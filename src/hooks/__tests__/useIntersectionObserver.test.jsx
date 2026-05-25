import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import useIntersectionObserver from '../useIntersectionObserver';

const HookProbe = () => {
  const [showSentinel, setShowSentinel] = useState(false);
  const { targetRef, isVisible } = useIntersectionObserver({
    rootMargin: '200px 0px',
  });

  return (
    <div>
      <button type="button" onClick={() => setShowSentinel(true)}>
        Exibir sentinela
      </button>
      <span>{isVisible ? 'visivel' : 'oculto'}</span>
      {showSentinel ? <div data-testid="sentinel" ref={targetRef} /> : null}
    </div>
  );
};

describe('useIntersectionObserver', () => {
  it('observa elemento que aparece depois do primeiro render', () => {
    render(<HookProbe />);

    expect(screen.getByText('oculto')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /exibir sentinela/i }));

    expect(screen.getByText('visivel')).toBeInTheDocument();
  });
});
