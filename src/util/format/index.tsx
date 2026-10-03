/**
 * A number as hexadecimal bytes, in groups of two digits, wide enough to hold it.
 *
 * A register value an operator reads: grouped bytes are how one is written in a manual, and
 * `minBytes` pads it to a fixed width so a column of them lines up.
 */
export function formatNumberAsHexBytes(x: number, minBytes = 0): string {
  const hex = x.toString(16).toUpperCase();
  const byteLength = Math.max(1, minBytes, Math.ceil(Math.log2(x + 1) / 8));

  return hex
    .padStart(byteLength * 2, '0')
    .replace(/../g, '$& ')
    .trim();
}

/**
 * A number as hexadecimal, upper case, zero-padded to `minDigits` and grouped in pairs.
 *
 * The formatting an identifier is displayed with — a MAC address, a serial, a hex colour.
 */
export function formatHexNumber(x: number, minDigits: number) {
  return x.toString(16).toUpperCase().padStart(minDigits, '0').replace(/../g, '$& ').trim();
}
