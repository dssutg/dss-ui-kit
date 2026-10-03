// Clamp a value between min and max inclusively
export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function lerp(min: number, max: number, progress: number) {
  return (1 - progress) * min + progress * max;
}

export function unlerp(min: number, max: number, value: number) {
  return (value - min) / (max - min);
}

export function lerpRange(min0: number, max0: number, min1: number, max1: number, value: number) {
  const progress = unlerp(min0, max0, value);

  return lerp(min1, max1, progress);
}

// This function computes the modulo of n (left operand)
// and m (right operand). However, this function also
// considers negative operands and wraps the result number
// accordingly that is returned.
export function modulo(a: number, b: number) {
  return ((a % b) + b) % b;
}

export function wrapIndex(index: number, length: number) {
  if (length === 0) {
    return 0;
  }
  return modulo(index, length);
}

export function step(x: number, threshold: number) {
  if (x >= threshold) {
    return 1;
  }
  return 0;
}

export function smoothStep(x: number, edge0: number, edge1: number) {
  const t = clamp(unlerp(edge0, edge1, x), 0, 1);

  return t * t * (3 - 2 * t);
}

export function binomial(n: number, k: number): number {
  if (k < 0 || k > n) {
    return 0;
  }

  if (k === 0 || k === n) {
    return 1;
  }

  let coefficient = 1;

  for (let i = 1; i <= k; i++) {
    coefficient = (coefficient * (n - i + 1)) / i;
  }

  return coefficient;
}

export function roundToPowerOfTwo(n: number): number {
  if (n <= 0) {
    return 0;
  }
  let power = 1;
  while (power < n) {
    power *= 2;
  }
  return power;
}

// This function compares the arguments a and b, and
// returns -1 if a < b, 1 if a > b, and 0 if a == b.
// Useful for sorting comparators.
export function cmp<T>(a: T, b: T) {
  if (a > b) {
    return 1;
  }
  if (a < b) {
    return -1;
  }
  return 0;
}

export function naturalCmp(a: string, b: string): number {
  const regex = /(\d+|\D+)/g;

  const aSegments = a.match(regex) ?? [];
  const bSegments = b.match(regex) ?? [];

  const maxSegments = Math.max(aSegments.length, bSegments.length);

  for (let i = 0; i < maxSegments; i++) {
    const order = cmpSegment(aSegments[i] ?? '', bSegments[i] ?? '');

    // Equal segments say nothing about the order of the strings; the next segment decides.
    if (order !== 0) {
      return order;
    }
  }

  return 0;
}

/**
 * The order of one segment against another.
 *
 * Two numeric segments compare as numbers, which is what puts `line2` before `line10`. A
 * numeric segment against a non-numeric one compares as text, because there is no number on both
 * sides to compare.
 */
function cmpSegment(aSegment: string, bSegment: string): number {
  const aIsNumber = /^\d+$/.test(aSegment);
  const bIsNumber = /^\d+$/.test(bSegment);

  if (aIsNumber && bIsNumber) {
    const aNumber = parseInt(aSegment, 10);
    const bNumber = parseInt(bSegment, 10);

    if (aNumber !== bNumber) {
      return cmp(aNumber, bNumber);
    }

    return 0;
  }

  return aSegment.localeCompare(bSegment);
}
