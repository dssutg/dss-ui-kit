/**
 * Thrown when a value does not validate, carrying a message written for whoever is looking at the
 * form rather than for a stack trace.
 *
 * Named so a caller's catch can tell a validation failure from a real error.
 */
export class VError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VError';
  }
}

/**
 * A check that a value is of type `T` and returns it narrowed, throwing {@link VError} if it is not.
 *
 * The returned value is what makes this usable for values that arrive as `unknown` — parsed JSON, a
 * form, a query string — where the whole point is that the type is not known until it is checked. The
 * parameter is `any` deliberately and is the one place in the library where it appears: a validator
 * has to accept whatever it is given in order to reject it.
 */
// biome-ignore lint: lint/suspicious/noExplicitAny
export type VValidator<T> = (value: any) => T;

/** The type a {@link VValidator} validates to. */
export type VInfer<T> = T extends VValidator<infer U> ? U : never;

/** One validator per key of the object a caller expects. */
export type VSchema<T> = {
  [K in keyof T]: VValidator<T[K]>;
};

/**
 * Runs every validator in order against the same value, and hands the value back when all pass.
 *
 * All of them run rather than stopping at the first failure, so a form field reports everything wrong
 * with it in one throw instead of only the first problem.
 */
export function vPipe<T>(...validators: VValidator<T>[]): VValidator<T> {
  return (value) => {
    for (const validator of validators) {
      validator(value);
    }
    return value;
  };
}

/**
 * Checks that a value is a boolean.
 *
 * The first validator to read: it says the type it expects and throws {@link VError} otherwise.
 */
export function vBoolean(): VValidator<boolean> {
  return (value) => {
    if (typeof value !== 'boolean') {
      throw new VError('Value must be a boolean');
    }
    return value;
  };
}

/**
 * Checks that a value is a number.
 *
 * `NaN` passes, because it is a number. Use {@link vInt} or a range validator to rule it out.
 */
export function vNumber(): VValidator<number> {
  return (value) => {
    if (typeof value !== 'number') {
      throw new VError('Value must be a number');
    }
    return value;
  };
}

/**
 * Checks that a value is a whole number small enough to be represented exactly, which is what makes
 * it safe to use as an index or a bitmask.
 */
export function vInt(): VValidator<number> {
  return (value) => {
    if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
      throw new VError('Value must be an integer');
    }
    return value;
  };
}

/**
 * Bounds for a number: below the threshold, at most it, above it, or at least it.
 *
 * Each of the four is a validator of its own — {@link vLt}, {@link vLe}, {@link vGt}, {@link vGe} —
 * because a strict and a non-strict bound are different rules a caller names rather than a flag. Each
 * also requires a number, so it never decides about a string.
 */
export function vLt(threshold: number): VValidator<number> {
  return (value) => {
    if (typeof value !== 'number' || value >= threshold) {
      throw new VError(`Value must be an integer less than ${threshold}`);
    }
    return value;
  };
}

export function vLe(threshold: number): VValidator<number> {
  return (value) => {
    if (typeof value !== 'number' || value > threshold) {
      throw new VError(`Value must be an integer less than or equal to ${threshold}`);
    }
    return value;
  };
}

export function vGt(threshold: number): VValidator<number> {
  return (value) => {
    if (typeof value !== 'number' || value <= threshold) {
      throw new VError(`Value must be an integer greater than ${threshold}`);
    }
    return value;
  };
}

export function vGe(threshold: number): VValidator<number> {
  return (value) => {
    if (typeof value !== 'number' || value < threshold) {
      throw new VError(`Value must be an integer greater than or equal to ${threshold}`);
    }
    return value;
  };
}

/**
 * Checks that a value is a string.
 *
 * An empty string passes: whether it is allowed is a separate question, and a text field may be
 * legitimately empty.
 */
export function vString(): VValidator<string> {
  return (value) => {
    if (typeof value !== 'string') {
      throw new VError('Value must be a string');
    }
    return value;
  };
}

/**
 * Checks a string against a pattern, a minimum length, a maximum length, or an exact length.
 *
 * Each of the four is a validator of its own — {@link vRegex}, {@link vMin}, {@link vMax},
 * {@link vLength} — because a caller names the rule a field has. Each also requires a string, so a
 * number is rejected by a length check rather than coerced into one.
 */
export function vRegex(regex: RegExp): VValidator<string> {
  return (value) => {
    if (typeof value !== 'string' || !regex.test(value)) {
      throw new VError(`Value must be a string that matches regexp ${regex}`);
    }
    return value;
  };
}

export function vMin(minLength: number): VValidator<string> {
  return (value) => {
    if (typeof value !== 'string' || value.length < minLength) {
      throw new VError(`Value must be at least ${minLength} characters long`);
    }
    return value;
  };
}

export function vMax(maxLength: number): VValidator<string> {
  return (value) => {
    if (typeof value !== 'string' || value.length > maxLength) {
      throw new VError(`Value must be at most ${maxLength} characters long`);
    }
    return value;
  };
}

/**
 * Requires a string of an exact length, for formats whose length is the format.
 *
 * Separate from {@link vMin} and {@link vMax} because a field such as a colour code or a fixed-width
 * identifier is wrong at any other length — a range would accept a prefix of it.
 */
export function vLength(length: number): VValidator<string> {
  return (value) => {
    if (typeof value !== 'string' || value.length !== length) {
      throw new VError(`Value must be ${length} characters long`);
    }
    return value;
  };
}

/**
 * Requires an array of an exact length, the array counterpart of {@link vLength}.
 *
 * For tuples read positionally — an address, a coordinate — where a missing or extra element means the
 * positions no longer mean what the caller expects.
 */
export function vArrayLength<T>(length: number): VValidator<T[]> {
  return (value) => {
    if (!Array.isArray(value) || value.length !== length) {
      throw new VError(`Value must be an array of exactly ${length} elements`);
    }
    return value;
  };
}

/**
 * The two absences, one validator each: exactly `null`, or exactly `undefined`.
 *
 * Separate validators rather than one because JSON has only `null`, while a form field distinguishes
 * the two, and a caller says which absence it means.
 */
export function vNull(): VValidator<null> {
  return (value) => {
    if (value !== null) {
      throw new VError('Value must be null');
    }
    return null;
  };
}

export function vUndefined(): VValidator<undefined> {
  return (value) => {
    if (value !== undefined) {
      throw new VError('Value must be undefined');
    }
    return undefined;
  };
}

/**
 * Validates an object key by key, so the errors name the field that failed.
 *
 * Each key's validator must consume the whole field: a key absent from the schema is dropped rather
 * than carried through, which is how a parsed payload is narrowed to exactly the fields the caller
 * named. An unknown key with no validator of its own cannot be checked and is not passed on.
 */
export function vObject<T>(schema: VSchema<T>): VValidator<T> {
  return (value) => {
    if (typeof value !== 'object' || value === null) {
      throw new VError('Value must be an object');
    }

    const result: Partial<T> = {};

    for (const key in schema) {
      const validator = schema[key];

      try {
        result[key] = validator(value[key]);
      } catch (error) {
        throw new VError(`Error in field "${key}": ${(error as Error)?.message ?? error}`);
      }
    }

    return result as T;
  };
}

/**
 * Checks that a value is an array and validates every element in it, so the result is an array of
 * things already known to be right.
 */
export function vArray<T>(itemValidator: VValidator<T>): VValidator<T[]> {
  return (value) => {
    if (!Array.isArray(value)) {
      throw new VError('Value must be an array');
    }

    let result: T[] = [];

    for (const item of value) {
      try {
        result = [...result, itemValidator(item)];
      } catch (error) {
        throw new VError(`Error in array item: ${(error as Error)?.message ?? error}`);
      }
    }

    return result;
  };
}

/**
 * Requires the value to be one of a fixed set of strings.
 *
 * For names a caller's protocol or config allows — a sort order, a mode. An `enum` is not used because
 * TypeScript enums are disallowed in this codebase; the accepted values are a literal union the caller
 * already has a type for.
 */
export function vEnum<T extends string>(allowedValues: readonly T[]): VValidator<T> {
  return (value) => {
    if (!allowedValues.includes(value)) {
      throw new VError(`Value must be one of: ${allowedValues.join(', ')}`);
    }
    return value;
  };
}

/**
 * Succeeds with the first validator that does, and fails only when all of them do.
 *
 * For a value one of several shapes. `vPipe` asserts every rule; this asserts at least one, which is
 * why the two take the same argument shape and are named after the logic rather than the syntax.
 */
export function vOr<T>(...validators: VValidator<T>[]): VValidator<T> {
  return (value) => {
    for (const validator of validators) {
      try {
        return validator(value);
      } catch {}
    }
    throw new VError('Value must satisfy at least one of the validators');
  };
}
