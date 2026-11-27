/**
 * `sizes` attributes that match the rendered width of posters, so the browser picks the right srcset candidate
 * at every breakpoint and pixel density. They mirror PAGE_CONTAINER (16px padding, 24px from sm, 40px from lg,
 * max 1600px) and the Tailwind breakpoints; keep them in sync with the classes they describe.
 */

const BREAKPOINTS = [0, 640, 768, 1024, 1280, 1536] as const;
const CONTAINER_MAX = 1600;
const padding = (bp: number) => (bp >= 1024 ? 40 : bp >= 640 ? 24 : 16);
const gap = (bp: number) => (bp >= 640 ? 16 : 12);

/** Columns per breakpoint: base, sm, md, lg, xl, 2xl (grids use gap-3, sm:gap-4). */
export type GridColumns = readonly [number, number, number, number, number, number];

/** Width of one column of a poster grid inside PAGE_CONTAINER, widest breakpoint first. */
export function gridSizes(cols: GridColumns): string {
  const gutter = (i: number) => 2 * padding(BREAKPOINTS[i]) + (cols[i] - 1) * gap(BREAKPOINTS[i]);
  const capped = Math.ceil((CONTAINER_MAX - gutter(5)) / cols[5]);
  const steps = BREAKPOINTS.map((bp, i) => {
    const width = `calc((100vw - ${gutter(i)}px) / ${cols[i]})`;
    return i === 0 ? width : `(min-width: ${bp}px) ${width}`;
  }).reverse();
  return [`(min-width: ${CONTAINER_MAX}px) ${capped}px`, ...steps].join(', ');
}

/** Rail poster width per breakpoint; RAIL_SIZES below states the same widths for srcset selection. */
export const RAIL_ITEM_CLASS = 'w-[38vw] max-w-44 sm:w-40 sm:max-w-none md:w-44 lg:w-48 xl:w-52 2xl:w-56';

export const RAIL_SIZES =
  '(min-width: 1536px) 224px, (min-width: 1280px) 208px, (min-width: 1024px) 192px, (min-width: 768px) 176px, (min-width: 640px) 160px, min(38vw, 176px)';
