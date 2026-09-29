export class VError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "VError";
	}
}

// biome-ignore lint: lint/suspicious/noExplicitAny
export type VValidator<T> = (value: any) => T;

export type VInfer<T> = T extends VValidator<infer U> ? U : never;

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

export function vBoolean(): VValidator<boolean> {
	return (value) => {
		if (typeof value !== "boolean") {
			throw new VError("Value must be a boolean");
		}
		return value;
	};
}

export function vNumber(): VValidator<number> {
	return (value) => {
		if (typeof value !== "number") {
			throw new VError("Value must be a number");
		}
		return value;
	};
}

export function vInt(): VValidator<number> {
	return (value) => {
		if (typeof value !== "number" || !Number.isSafeInteger(value)) {
			throw new VError("Value must be an integer");
		}
		return value;
	};
}

export function vLt(threshold: number): VValidator<number> {
	return (value) => {
		if (typeof value !== "number" || value >= threshold) {
			throw new VError(`Value must be an integer less than ${threshold}`);
		}
		return value;
	};
}

export function vLe(threshold: number): VValidator<number> {
	return (value) => {
		if (typeof value !== "number" || value > threshold) {
			throw new VError(
				`Value must be an integer less than or equal to ${threshold}`,
			);
		}
		return value;
	};
}

export function vGt(threshold: number): VValidator<number> {
	return (value) => {
		if (typeof value !== "number" || value <= threshold) {
			throw new VError(`Value must be an integer greater than ${threshold}`);
		}
		return value;
	};
}

export function vGe(threshold: number): VValidator<number> {
	return (value) => {
		if (typeof value !== "number" || value < threshold) {
			throw new VError(
				`Value must be an integer greater than or equal to ${threshold}`,
			);
		}
		return value;
	};
}

export function vString(): VValidator<string> {
	return (value) => {
		if (typeof value !== "string") {
			throw new VError("Value must be a string");
		}
		return value;
	};
}

export function vRegex(regex: RegExp): VValidator<string> {
	return (value) => {
		if (typeof value !== "string" || !regex.test(value)) {
			throw new VError(`Value must be a string that matches regexp ${regex}`);
		}
		return value;
	};
}

export function vMin(minLength: number): VValidator<string> {
	return (value) => {
		if (typeof value !== "string" || value.length < minLength) {
			throw new VError(`Value must be at least ${minLength} characters long`);
		}
		return value;
	};
}

export function vMax(maxLength: number): VValidator<string> {
	return (value) => {
		if (typeof value !== "string" || value.length > maxLength) {
			throw new VError(`Value must be at most ${maxLength} characters long`);
		}
		return value;
	};
}

export function vLength(length: number): VValidator<string> {
	return (value) => {
		if (typeof value !== "string" || value.length !== length) {
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
			throw new VError("Value must be null");
		}
		return null;
	};
}

export function vUndefined(): VValidator<undefined> {
	return (value) => {
		if (value !== undefined) {
			throw new VError("Value must be undefined");
		}
		return undefined;
	};
}

export function vObject<T>(schema: VSchema<T>): VValidator<T> {
	return (value) => {
		if (typeof value !== "object" || value === null) {
			throw new VError("Value must be an object");
		}

		const result: Partial<T> = {};

		for (const key in schema) {
			const validator = schema[key];

			try {
				result[key] = validator(value[key]);
			} catch (error) {
				throw new VError(
					`Error in field "${key}": ${(error as Error)?.message ?? error}`,
				);
			}
		}

		return result as T;
	};
}

export function vArray<T>(itemValidator: VValidator<T>): VValidator<T[]> {
	return (value) => {
		if (!Array.isArray(value)) {
			throw new VError("Value must be an array");
		}

		let result: T[] = [];

		for (const item of value) {
			try {
				result = [...result, itemValidator(item)];
			} catch (error) {
				throw new VError(
					`Error in array item: ${(error as Error)?.message ?? error}`,
				);
			}
		}

		return result;
	};
}

export function vEnum<T extends string>(
	allowedValues: readonly T[],
): VValidator<T> {
	return (value) => {
		if (!allowedValues.includes(value)) {
			throw new VError(`Value must be one of: ${allowedValues.join(", ")}`);
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
		throw new VError("Value must satisfy at least one of the validators");
	};
}
