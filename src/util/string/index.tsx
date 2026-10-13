/**
 * Upper-cases the first character and hands the rest back untouched.
 *
 * It is one character's capitalisation, not title-casing: no word boundaries are found and the
 * remainder keeps its existing case and separators, so `hello WORLD` becomes `Hello WORLD`.
 */
export function capitalize(sequence = '') {
  return sequence.charAt(0).toUpperCase() + sequence.slice(1);
}

/**
 * Strips the trailing line breaks — `\n`, `\r`, or any run of both — from one string.
 *
 * It deliberately stops at newlines and does not trim spaces or tabs, and it only looks at the end:
 * a line break between content stays exactly where it is. This exists for reading streamed text line
 * by line, so it is written as an index walk over `charCodeAt` instead of a regex, and it returns the
 * original string reference whenever nothing has to change rather than always allocating a copy.
 */
export function trimEndNewlines(str: string) {
  //@ verify
  //@ ensures \result.length <= str.length
  //@ ensures str.slice(0, \result.length) === \result
  //@ ensures forall(k, \result.length <= k && k < str.length ==> (str.charCodeAt(k) === 10 || str.charCodeAt(k) === 13))
  //@ ensures \result.length === 0 || (str.charCodeAt(\result.length - 1) !== 10 && str.charCodeAt(\result.length - 1) !== 13)
  let end = str.length;

  while (end > 0) {
    //@ invariant 0 <= end && end <= str.length
    //@ invariant forall(k, end <= k && k < str.length ==> (str.charCodeAt(k) === 10 || str.charCodeAt(k) === 13))
    //@ decreases end
    const c = str.charCodeAt(end - 1);
    if (c !== 10 && c !== 13) {
      // \n = 10, \r = 13
      break;
    }
    end--;
  }

  // If nothing changed, return the original string reference
  return end === str.length ? str : str.slice(0, end);
}
