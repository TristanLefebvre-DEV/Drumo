export interface TimelineLayout {
  activeStep: number;
  targetScrollLeft: number; // pixels the grid area should scroll to
}

/**
 * Computes the desired horizontal scroll so the playback cursor sits at
 * `anchorFraction` of the visible grid area (default 40% from left).
 */
export const computeTimeline = (
  activeTick: number,
  stepTicks: number,
  cellW: number,
  gridVisibleWidth: number,
  anchorFraction = 0.4
): TimelineLayout => {
  const activeStep = Math.round(activeTick / stepTicks);
  const cursorGridX = activeStep * cellW; // cursor x in grid-space
  const targetScrollLeft = Math.max(0, cursorGridX - gridVisibleWidth * anchorFraction);
  return { activeStep, targetScrollLeft };
};

/**
 * Smooth-scroll lerp. Factor ~0.12 gives a nice lag-free camera follow.
 * Use factor 1.0 to snap instantly (when not playing).
 */
export const lerpScroll = (current: number, target: number, factor = 0.12): number =>
  current + (target - current) * factor;
