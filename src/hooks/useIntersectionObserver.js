import { useCallback, useEffect, useRef, useState } from 'react';

const isBrowser = typeof window !== 'undefined';

const useIntersectionObserver = ({
  threshold = 0.2,
  root = null,
  rootMargin = '0px',
  freezeOnceVisible = false,
} = {}) => {
  const [targetNode, setTargetNode] = useState(null);
  const observerRef = useRef(null);
  const [entry, setEntry] = useState(null);
  const frozenRef = useRef(false);

  const targetRef = useCallback((node) => {
    setTargetNode(node);
  }, []);

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
    if (!isBrowser || !targetNode) {
      return;
    }

    if (typeof IntersectionObserver === 'undefined') {
      setEntry({ isIntersecting: true, target: targetNode });
      return;
    }

    const observer = new IntersectionObserver(handleIntersection, {
      threshold,
      root,
      rootMargin,
    });

    observerRef.current = observer;
    observer.observe(targetNode);

    return () => {
      observer.disconnect();

      if (observerRef.current === observer) {
        observerRef.current = null;
      }
    };
  }, [handleIntersection, root, rootMargin, targetNode, threshold]);

  useEffect(() => {
    if (!targetNode) {
      setEntry(null);
    }

    frozenRef.current = false;
  }, [freezeOnceVisible, targetNode]);

  const isVisible = entry?.isIntersecting ?? false;

  return { targetRef, isVisible, entry };
};

export default useIntersectionObserver;

