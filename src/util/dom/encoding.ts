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
