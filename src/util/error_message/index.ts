// SPDX-License-Identifier: MIT
/**
 * Turns a caught value into the message to show, without assuming it is an `Error`.
 *
 * A `catch` binding is `unknown` because JavaScript allows anything to be thrown, and code that
 * reads `.message` off it compiles only by asserting what it cannot prove. An `Error` carries the
 * message the thrower wrote; any other value is rendered by `String`, which is the reading that
 * keeps a thrown string, number or object from turning into an empty label.
 *
 * @param error The value a `catch` caught.
 * @returns Its `message` when it is an `Error`, otherwise its string form.
 */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
