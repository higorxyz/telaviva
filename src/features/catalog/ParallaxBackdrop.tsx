'use client';

import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import type { ReactNode } from 'react';

const MAX_SHIFT = 40;

/** Slow vertical drift on scroll. Static under prefers-reduced-motion. */
export function ParallaxBackdrop({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 700], [0, reduce ? 0 : MAX_SHIFT]);
  return (
    <motion.div
      aria-hidden="true"
      style={{ y }}
      className="absolute inset-x-0 -top-10 -bottom-2"
    >
      {children}
    </motion.div>
  );
}
