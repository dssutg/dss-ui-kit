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

export function vLength(length: number): VValidator<string> {
  return (value) => {
    if (typeof value !== 'string' || value.length !== length) {
      throw new VError(`Value must be ${length} characters long`);
    }
    return value;
  };
}

export function vArrayLength<T>(length: number): VValidator<T[]> {
  return (value) => {
    if (!Array.isArray(value) || value.length !== length) {
      throw new VError(`Value must be an array of exactly ${length} elements`);
    }
    return value;
  };
}

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

export function vEnum<T extends string>(allowedValues: readonly T[]): VValidator<T> {
  return (value) => {
    if (!allowedValues.includes(value)) {
      throw new VError(`Value must be one of: ${allowedValues.join(', ')}`);
    }
    return value;
  };
}

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
