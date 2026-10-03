import { clamp } from '@/util/math';

/**
 * Coercion table for render props: turns `unknown` data arriving from outside the UI into the value a
 * component renders.
 *
 * Every member accepts whatever the wire, a config file or a caller handed over and answers with a
 * usable value of its name — never `undefined`, never an exception. Absence and garbage read as the
 * type's zero (`''`, `false`, `0`, `[]`, `{}`), which is why nothing here is for data whose type or
 * range the caller wants enforced rather than repaired. Numbers are clamped into range before a
 * component sees them, so a mis-typed byte or port stays a colour and a port instead of becoming a
 * failed lookup downstream.
 */
export const rp = {
  /**
   * Everything becomes a string, using the same rendering `String()` would.
   *
   * Absent input is `''` rather than `'null'`/`'undefined'` — blank is what an empty field reads as,
   * and the name of a missing value is not something to show an operator. The string fast path keeps
   * the identity so a render prop that is already a string is unchanged.
   */
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

  /**
   * Truthiness of the incoming value, with `false` as the answer for absence.
   *
   * Numbers follow C rules (`0` is false), non-empty arrays and objects are true, and the string
   * `'false'` — in any case, padded with any whitespace — is false along with strings of nothing but
   * zeros. Anything else, including every other non-empty string, is true. It is a lenient flag
   * reader for values typed by hand, not a parser: a boolean caller never needs it, and a string like
   * `'0.0'` is true because it is not all zeros.
   */
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

  /**
   * A base-10 integer, truncated toward zero and clamped to the safe integer range.
   *
   * Anything unparsable — `NaN`, a string with no digits in it, an object — becomes `0` rather than an
   * error, and fractions are truncated rather than rounded (`255.7` is `255`). A string that already
   * looks like a signed decimal parses whole; anything else is stripped down to a run of the
   * characters that could form one and then parsed, so `'px-12'` is `-12`. The clamp keeps a value
   * beyond the safe range from silently losing precision in arithmetic later on.
   */
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

  /** {@link rp.decimalInt} with negatives folded up to `0` — the shape of a count or an index. */
  decimalUint: (x: unknown) => Math.max(0, rp.decimalInt(x)),

  /** {@link rp.decimalUint} capped at 255 — one unsigned byte, as a colour channel wants it. */
  decimalByte: (x: unknown) => Math.max(0, Math.min(rp.decimalInt(x), 255)),

  /** {@link rp.decimalInt} clamped into `0..65535` — a TCP port number. */
  port: (x: unknown) => clamp(rp.decimalInt(x), 0, 65_535),

  /**
   * A base-16 integer — the numeric half of a hex colour, a bit mask, an address.
   *
   * The coercion rules are {@link rp.decimalInt}'s with the radix changed: an `0x` prefix parses
   * (`'0x10'` is 16) because `parseInt` accepts it, and the slow path strips everything that cannot
   * appear in hex before parsing, so a stray `'0x'` inside a longer string does not stop it. The
   * `.` it leaves in place is harmless — `parseInt` in base 16 drops the fractional part. Absent and
   * unparsable input is `0`, and truncation and the safe-range clamp work as in the decimal version.
   */
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

  /**
   * The value as a list.
   *
   * An array is handed back as itself, a non-array object contributes its `Object.values` — this is
   * what a `Record` sent over the wire turns into — and everything else, including strings and class
   * wrappers, is an empty list. Note the type parameter is trusted, not checked: the caller states
   * what the elements are and nothing here verifies them.
   */
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

  /**
   * The value as a dictionary, or `{}` when it is not usable as one.
   *
   * Arrays and string wrappers fail on purpose — an array's keys are its indices, and that is not the
   * mapping a caller asked for; the same input to {@link rp.array} would have read as a list instead.
   * The members are unchecked, so a caller that cares narrows the values itself.
   */
  recordStringUnknown: (x: unknown): Record<string, unknown> =>
    typeof x === 'object' && !Array.isArray(x) && !(x instanceof String) && x !== null
      ? (x as Record<string, unknown>)
      : ({} as Record<string, unknown>),

  /**
   * Runs a mapping over the value read as a dictionary.
   *
   * It is a convenience over {@link rp.recordStringUnknown} for the common shape "take this unknown
   * thing, if it is a record produce something from it, otherwise produce the fallback inside the
   * mapper" — so the fallback decision lives with the caller's mapper, not here.
   */
  record<T>(x: unknown, mapper: (record: Record<string, unknown>) => T) {
    return mapper(rp.recordStringUnknown(x));
  },

  /**
   * Keeps a string only when it is one of the accepted values, and answers the fallback otherwise.
   *
   * Unlike the numeric members this one repairs by substitution rather than coercion: an unknown value
   * does not become a near miss, it becomes exactly `fallbackValue`. The comparison is `===` over the
   * whole string, so case and whitespace are not forgiven — a caller that wants `'Active'` to match
   * `'active'` normalises before calling.
   */
  stringMatchesEnum<T extends string>(
    sequence: string,
    validValues: readonly T[],
    fallbackValue: T,
  ): T {
    return (validValues as unknown[]).includes(sequence) ? (sequence as T) : fallbackValue;
  },
} as const;
