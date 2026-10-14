// SPDX-License-Identifier: MIT
/**
 * The `dss-ui-kit/testing` subpath entry. It is a single re-export, and the point of the file is that
 * the helpers exist there and nowhere in the runtime surface, so the test loads it and reaches one
 * helper through it.
 */
import { describe, expect, it } from 'vitest';
import { cleanup, render } from '@/testing';

describe('the testing subpath', () => {
  it('re-exports the render helpers', () => {
    expect(render).toBeTypeOf('function');
    expect(cleanup).toBeTypeOf('function');
  });
});
