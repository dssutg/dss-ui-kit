/**
 * Decodes a base64 string holding gzipped JSON and returns whatever it parses to.
 *
 * The return type is deliberately left untyped: this is an escape hatch for whole payloads whose
 * shape the library does not know or want to vouch for, so a caller receives `any`-shaped JSON and
 * narrows it itself — a generic here would only launder an unchecked `as` into the signature.
 *
 * It throws, rather than returning a default, on any step that fails — an invalid base64 input from
 * `atob`, a body that cannot be read, a truncated gzip stream from `DecompressionStream`, or JSON
 * that does not parse. A malformed payload is a bug upstream, and a silent `null` would move the
 * report to a broken-looking component far from the sender.
 */
export async function decompressJSON(base64Str: string) {
  // Decode Base64 to ArrayBuffer
  const binaryString = atob(base64Str);
  const len = binaryString.length;
  const buffer = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    buffer[i] = binaryString.charCodeAt(i);
  }

  // Create a stream from the ArrayBuffer
  const compressedStream = new Response(buffer).body;

  if (compressedStream === null) {
    throw new Error('decompressJSON: the response has no readable body.');
  }

  // Pipe through the gzip decompressor
  const ds = new DecompressionStream('gzip');
  const decompressedStream = compressedStream.pipeThrough(ds);

  // Read the decompressed stream as text
  const json = await new Response(decompressedStream).text();

  const result = JSON.parse(json);

  return result;
}
