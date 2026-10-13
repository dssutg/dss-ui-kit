/**
 * `decompressJSON` is the escape hatch for transport payloads: gzip + base64 in, untyped JSON out,
 * and a malformed payload is a throw rather than a silent default. The suite builds its fixtures
 * with the platform's own `CompressionStream` (round-trip is what proves the pipe), then drives the
 * failure modes the contract names: a `base64` string `atob` cannot read, a gzip stream that is
 * truncated, and a body that decompresses to text that is not JSON. It runs in the node
 * environment: the function is pure stream plumbing with no DOM in it.
 */
import { describe, expect, test, vi } from 'vitest';
import { decompressJSON } from './encoding';

/** Gzips `value` and base64-encodes the bytes, the inverse of what `decompressJSON` does. */
async function gzipBase64(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const compressed = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
  const buffer = await new Response(compressed).arrayBuffer();

  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

describe('decompressJSON', () => {
  test('decodes a gzipped, base64-encoded JSON payload', async () => {
    await expect(
      decompressJSON(await gzipBase64(JSON.stringify({ alpha: ['x', 2] }))),
    ).resolves.toEqual({
      alpha: ['x', 2],
    });
  });

  test('round-trips scalars and null too', async () => {
    await expect(decompressJSON(await gzipBase64('null'))).resolves.toBeNull();
    await expect(decompressJSON(await gzipBase64('3.5'))).resolves.toBe(3.5);
  });

  test('throws on input atob cannot decode', async () => {
    await expect(decompressJSON('not@base64@')).rejects.toThrowError();
  });

  test('throws on a truncated gzip stream', async () => {
    const bytes = new TextEncoder().encode('x');
    const compressed = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
    const buffer = await new Response(compressed).arrayBuffer();
    const full = new Uint8Array(buffer);
    const truncated: number[] = [];
    for (let index = 0; index < 8; index += 1) {
      const byte = full[index];
      if (byte !== undefined) {
        truncated.push(byte);
      }
    }

    await expect(decompressJSON(btoa(String.fromCharCode(...truncated)))).rejects.toThrowError();
  });

  test('throws on JSON that does not parse', async () => {
    await expect(decompressJSON(await gzipBase64('not json'))).rejects.toThrowError();
  });

  test('throws on an empty payload', async () => {
    await expect(decompressJSON('')).rejects.toThrowError();
  });

  /**
   * The guard exists for a runtime whose `Response` reports no readable body — a platform without
   * body support is one the guard is written to name, not swallow — so the stub stands in for that
   * runtime and the test pins the error the caller then sees.
   */
  test('throws the body-guard error when the runtime gives the response no body', async () => {
    vi.stubGlobal(
      'Response',
      class BodyLessResponse {
        readonly body: ReadableStream | null = null;
      },
    );

    try {
      await expect(decompressJSON('aGk=')).rejects.toThrowError(
        'decompressJSON: the response has no readable body.',
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
