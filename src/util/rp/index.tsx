import { clamp } from '@/util/math';

export const rp = {
  string: (x: unknown): string => {
    // Fast path for string
    if (typeof x === 'string') {
      return x;
    }

    // Fast path for null or undefined
    if (x === null || x === undefined) {
      return '';
    }

    // Slow path for other types
    return x.toString();
  },

  boolean: (x: unknown) => {
    if (typeof x === 'boolean') {
      return x;
    }

    if (x === null || x === undefined) {
      return false;
    }

    if (typeof x === 'number') {
      return x !== 0;
    }

    if (Array.isArray(x)) {
      // Non-empty arrays are true
      return x.length > 0;
    }

    if (typeof x === 'object') {
      // Non-empty objects are true
      return Object.keys(x).length > 0;
    }

    if (typeof x === 'string' || (typeof x === 'object' && x instanceof String)) {
      return !/^0+$/.test(x.replace(/\s+/g, '')) && x.replace(/\s+/g, '').toLowerCase() !== 'false';
    }

    // Default case for unsupported types
    return false;
  },

  decimalInt: (x: unknown) => {
    // Fast path for number
    if (typeof x === 'number') {
      if (Number.isNaN(x)) {
        return 0;
      }
      return clamp(Math.trunc(x), Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
    }

    // Fast path for boolean
    if (typeof x === 'boolean') {
      return Number(x);
    }

    // Fast path for null or undefined
    if (x === null || x === undefined) {
      return 0;
    }

    // Fast path for empty string
    if (x === '') {
      return 0;
    }

    // Fast path for kind of valid strings
    if (typeof x === 'string' && /^[\d+.-]+$/.test(x)) {
      return clamp(parseInt(x, 10) || 0, Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
    }

    // Slow path for other types
    return clamp(
      parseInt(x.toString().replace(/[^\d+.-]+/g, ''), 10) || 0,
      Number.MIN_SAFE_INTEGER,
      Number.MAX_SAFE_INTEGER,
    );
  },

  decimalUint: (x: unknown) => Math.max(0, rp.decimalInt(x)),

  decimalByte: (x: unknown) => Math.max(0, Math.min(rp.decimalInt(x), 255)),

  port: (x: unknown) => clamp(rp.decimalInt(x), 0, 65_535),

  hexInt: (x: unknown) => {
    // Fast path for number
    if (typeof x === 'number') {
      if (Number.isNaN(x)) {
        return 0;
      }
      return clamp(Math.trunc(x), Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
    }

    // Fast path for boolean
    if (typeof x === 'boolean') {
      return Number(x);
    }

    // Fast path for null or undefined
    if (x === null || x === undefined) {
      return 0;
    }

    // Fast path for empty string
    if (x === '') {
      return 0;
    }

    // Fast path for kind of valid strings
    if (typeof x === 'string' && /^[\d+.A-Fa-f-]+$/.test(x)) {
      return clamp(parseInt(x, 16) || 0, Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
    }

    // Slow path for other types
    return clamp(
      parseInt(x.toString().replace(/[^\d+.A-Fa-f-]+/g, ''), 16) || 0,
      Number.MIN_SAFE_INTEGER,
      Number.MAX_SAFE_INTEGER,
    );
  },

  array<T>(x: unknown): T[] {
    // Fast path for array
    if (Array.isArray(x)) {
      return x;
    }

    if (typeof x === 'object' && !(x instanceof String) && x !== null) {
      return Object.values(x);
    }

    return [];
  },

  recordStringUnknown: (x: unknown): Record<string, unknown> =>
    typeof x === 'object' && !Array.isArray(x) && !(x instanceof String) && x !== null
      ? (x as Record<string, unknown>)
      : ({} as Record<string, unknown>),

  record<T>(x: unknown, mapper: (record: Record<string, unknown>) => T) {
    return mapper(rp.recordStringUnknown(x));
  },

  stringMatchesEnum<T extends string>(
    sequence: string,
    validValues: readonly T[],
    fallbackValue: T,
  ): T {
    return (validValues as unknown[]).includes(sequence) ? (sequence as T) : fallbackValue;
  },
} as const;
