import { useCallback, useEffect, useRef, useState } from 'react';

const isBrowser = typeof window !== 'undefined';

const useIntersectionObserver = ({
  threshold = 0.2,
  root = null,
  rootMargin = '0px',
  freezeOnceVisible = false,
} = {}) => {
  const targetRef = useRef(null);
  const observerRef = useRef(null);
  const [entry, setEntry] = useState(null);
  const frozenRef = useRef(false);

  const handleIntersection = useCallback((entries) => {
    const [observedEntry] = entries;

    if (frozenRef.current && observedEntry.isIntersecting) {
      return;
    }

    if (freezeOnceVisible && observedEntry.isIntersecting) {
      frozenRef.current = true;
    }

    setEntry(observedEntry);
  }, [freezeOnceVisible]);

  useEffect(() => {
    const node = targetRef.current;

    if (!isBrowser || !node) {
      return;
    }

    if (typeof IntersectionObserver === 'undefined') {
      setEntry({ isIntersecting: true, target: node });
      return;
    }

    if (!observerRef.current) {
      observerRef.current = new IntersectionObserver(handleIntersection, {
        threshold,
        root,
        rootMargin,
      });
    }

    observerRef.current.observe(node);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [handleIntersection, root, rootMargin, threshold]);

  useEffect(() => {
    return () => {
      frozenRef.current = false;
    };
  }, []);

  const isVisible = entry?.isIntersecting ?? false;

  return { targetRef, isVisible, entry };
};

export default useIntersectionObserver;

