export class Base64ResponseParser {
	private bytes: Uint8Array;
	private index: number;

	constructor(base64: unknown) {
		if (typeof base64 !== "string") {
			throw new Error("expected valid base64 string");
		}

		const binStr = atob(base64);
		this.bytes = new Uint8Array(binStr.length);
		for (let i = 0; i < binStr.length; i++) {
			this.bytes[i] = binStr.charCodeAt(i);
		}

		this.index = 0;
	}

	uleb128() {
		let value = 0;
		let shift = 0;
		let length = 0;

		for (let i = this.index; i < this.bytes.length; i++) {
			const byte = this.bytes[i]!;

			value = value | ((byte & 0x7f) << shift);
			shift = shift + 7;
			length = length + 1;

			// If the high bit is not set, this is the final byte
			if ((byte & 0x80) === 0) {
				this.index = this.index + length;

				return value;
			}
		}

		// If we reach here, the number was not terminated
		throw new Error("Invalid ULEB128 sequence: Missing terminating byte");
	}

	dispatch<T>(
		dispatchTable: Record<number, (parser: Base64ResponseParser) => T>,
	): T {
		const version = this.uleb128();

		const handler = dispatchTable[version];

		if (handler === undefined) {
			throw new Error(`Unsupported version ${version}`);
		}

		const result = handler(this);

		this.done();

		return result;
	}

	done() {
		if (this.index < this.bytes.length) {
			throw new Error("Expected end of binary data");
		}
	}
}

export function parseBase64Response<T>(
	data: unknown,
	dispatchTable: Record<number, (parser: Base64ResponseParser) => T>,
) {
	return new Base64ResponseParser(data).dispatch(dispatchTable);
}
