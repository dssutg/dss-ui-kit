import { clamp } from './math';

export function getDpr() {
  return Math.max(1, window.devicePixelRatio || 1);
}

// This function performs a tricky dance to make
// font sizes responsive depending on screen width.
export function getResponsiveSize(
  minSize = 0,
  maxSize = 0,
  growFactor = 0,
  mediaWidth = 0,
  minDesktopWidth = 1,
) {
  const size = (growFactor * mediaWidth) / minDesktopWidth;

  return clamp(size, minSize, maxSize);
}
