/**
 * A random RFC 4122 version 4 identifier, from `crypto.getRandomValues`.
 *
 * For keys a caller needs to be unique rather than ordered: a row added to a list, a dragged item. Not
 * sortable by time, which is the point — a caller that needs creation order has its own creation
 * order.
 */
export function uuidv4(): string {
  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (char) => {
    return (
      Number(char) ^
      ((crypto.getRandomValues(new Uint8Array(1))[0] ?? 0) & (15 >> (Number(char) / 4)))
    ).toString(16);
  });
}
