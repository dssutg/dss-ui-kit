// SPDX-License-Identifier: MIT
/**
 * Unpadded base64url encoding from RFC 4648 §5.
 *
 * The output uses the URL- and filename-safe alphabet (`-` and `_` instead of `+` and `/`) and
 * never carries `=` padding, so it can sit in a URL path or a filename without escaping. The
 * functions are written with integer arithmetic only, so they work in every JavaScript runtime
 * without `Buffer`, `btoa` or `atob`.
 */

/**
 * Whether a character code is in the base64url alphabet.
 *
 * The alphabet is `A-Z`, `a-z`, `0-9`, `-` and `_`; padding is deliberately not part of it.
 */
function isBase64UrlCode(code: number): boolean {
  //@ verify
  //@ ensures \result === ((code >= 65 && code <= 90) || (code >= 97 && code <= 122) || (code >= 48 && code <= 57) || code === 45 || code === 95)
  return (
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122) ||
    (code >= 48 && code <= 57) ||
    code === 45 ||
    code === 95
  );
}

/**
 * The character code of one 6-bit value.
 *
 * The values run through `A-Z`, then `a-z`, then `0-9`, then `-` and `_`, which are codes 62 and
 * 63.
 */
function base64UrlCode(value: number): number {
  //@ verify
  //@ requires value >= 0 && value <= 63
  //@ ensures isBase64UrlCode(\result)
  //@ ensures value < 26 ==> \result === 65 + value
  //@ ensures value >= 26 && value < 52 ==> \result === 97 + value - 26
  //@ ensures value >= 52 && value < 62 ==> \result === 48 + value - 52
  //@ ensures value === 62 ==> \result === 45
  //@ ensures value === 63 ==> \result === 95
  if (value < 26) {
    return 65 + value;
  }
  if (value < 52) {
    return 97 + value - 26;
  }
  if (value < 62) {
    return 48 + value - 52;
  }
  if (value === 62) {
    return 45;
  }
  return 95;
}

/**
 * The 6-bit value of one alphabet character code, or `-1` when the code is outside the alphabet.
 *
 * This is the rejecting half of decoding: every code outside the alphabet, including `=` padding,
 * reports `-1` rather than being read as some nearby value or skipped.
 */
function base64UrlValue(code: number): number {
  //@ verify
  //@ ensures \result >= -1 && \result <= 63
  //@ ensures \result === -1 <==> !isBase64UrlCode(code)
  //@ ensures \result >= 0 <==> isBase64UrlCode(code)
  if (!isBase64UrlCode(code)) {
    return -1;
  }
  if (code >= 65 && code <= 90) {
    return code - 65;
  }
  if (code >= 97 && code <= 122) {
    return code - 71;
  }
  if (code >= 48 && code <= 57) {
    return code + 4;
  }
  if (code === 45) {
    return 62;
  }
  return 63;
}

/**
 * Reads one alphabet character, rejecting anything outside the alphabet with an error naming it.
 *
 * The character code and the reported character are both taken from the same index, so a caller
 * gets the offending input rather than an offset.
 */
function readBase64UrlValue(input: string, index: number): number {
  //@ verify
  //@ requires 0 <= index && index < input.length
  //@ requires base64UrlValue(input.charCodeAt(index)) >= 0
  //@ ensures \result === base64UrlValue(input.charCodeAt(index))
  //@ ensures \result >= 0 && \result <= 63
  const value = base64UrlValue(input.charCodeAt(index));

  if (value < 0) {
    throw new Error(`Invalid base64url character: ${input.charAt(index)}`);
  }

  return value;
}

/** The encoding core, over plain numbers so the proof talks about bytes rather than a view. */
function encodeBase64Url(bytes: readonly number[]): string {
  //@ verify
  //@ requires forall(k, 0 <= k && k < bytes.length ==> bytes[k] >= 0 && bytes[k] <= 255)
  //@ ensures forall(k, 0 <= k && k < \result.length ==> isBase64UrlCode(\result.charCodeAt(k)))
  //@ ensures forall(k, 0 <= k && k < \result.length ==> \result.charCodeAt(k) !== 61)
  let output = '';

  for (let i = 0; i < bytes.length; i += 3) {
    //@ invariant 0 <= i && i <= bytes.length + 2
    //@ invariant i % 3 === 0
    //@ invariant forall(k, 0 <= k && k < output.length ==> isBase64UrlCode(output.charCodeAt(k)))
    //@ invariant forall(k, 0 <= k && k < output.length ==> output.charCodeAt(k) !== 61)
    //@ decreases bytes.length - i
    const remaining = bytes.length - i;
    // The loop condition keeps `i` inside the array; the fallback only satisfies the compiler.
    // v8 ignore next
    const first = bytes[i] ?? 0;
    // `remaining > 1` keeps `i + 1` inside the array.
    // v8 ignore next
    const second = remaining > 1 ? (bytes[i + 1] ?? 0) : 0;
    // `remaining > 2` keeps `i + 2` inside the array.
    // v8 ignore next
    const third = remaining > 2 ? (bytes[i + 2] ?? 0) : 0;

    output += String.fromCharCode(base64UrlCode(first >> 2));
    output += String.fromCharCode(base64UrlCode(((first & 3) << 4) + (second >> 4)));

    if (remaining > 1) {
      output += String.fromCharCode(base64UrlCode(((second & 15) << 2) + (third >> 6)));
    }
    if (remaining > 2) {
      output += String.fromCharCode(base64UrlCode(third & 63));
    }
  }

  return output;
}

/** The decoding core, over plain numbers so the proof talks about bytes rather than a view. */
function decodeBase64Url(input: string): number[] {
  //@ verify
  //@ requires input.length % 4 !== 1
  //@ requires forall(k, 0 <= k && k < input.length ==> base64UrlValue(input.charCodeAt(k)) >= 0)
  //@ ensures input.length === 0 ==> \result.length === 0
  //@ ensures forall(k, 0 <= k && k < \result.length ==> \result[k] >= 0 && \result[k] <= 255)
  const output: number[] = [];

  if (input.length === 0) {
    return output;
  }

  for (let i = 0; i < input.length; i += 4) {
    //@ invariant 0 <= i && i <= input.length + 3
    //@ invariant i % 4 === 0
    //@ invariant forall(k, 0 <= k && k < output.length ==> output[k] >= 0 && output[k] <= 255)
    //@ decreases input.length - i
    const remaining = input.length - i;
    const first = readBase64UrlValue(input, i);
    const second = readBase64UrlValue(input, i + 1);

    output.push((first << 2) + (second >> 4));

    if (remaining > 2) {
      const third = readBase64UrlValue(input, i + 2);

      output.push(((second & 15) << 4) + (third >> 2));

      if (remaining > 3) {
        const fourth = readBase64UrlValue(input, i + 3);

        output.push(((third & 3) << 6) + fourth);
      }
    }
  }

  return output;
}

/**
 * Encodes bytes as unpadded base64url.
 *
 * Every emitted character belongs to the RFC 4648 §5 alphabet, and no `=` is appended: the last
 * group carries two or three characters instead of being padded.
 *
 * @param bytes The bytes to encode.
 * @returns The unpadded base64url text.
 */
export function toBase64Url(bytes: Uint8Array): string {
  return encodeBase64Url(Array.from(bytes));
}

/**
 * Decodes unpadded base64url into bytes.
 *
 * A character outside the alphabet is a hard error naming that character, so truncation or a
 * stray `=` is reported instead of decoded as a shorter value. A length of one character modulo
 * four is rejected as well, because no byte sequence encodes to it; every other length is
 * accepted, and the final group contributes however many whole bytes its bits carry.
 *
 * @param input The unpadded base64url text.
 * @returns The decoded bytes.
 */
export function fromBase64Url(input: string): Uint8Array<ArrayBuffer> {
  if (input.length % 4 === 1) {
    throw new Error(`Invalid base64url length: ${input.length}`);
  }

  return new Uint8Array(decodeBase64Url(input));
}
