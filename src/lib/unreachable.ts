/**
 * Fails to compile when it is reached, and throws when it somehow runs anyway.
 *
 * A `switch` over a union with no `default` typechecks as though it returned `undefined` down the
 * path the compiler cannot see, so a member added to that union later renders as an empty cell
 * instead of breaking the build. The parameter is `never`, which is what makes adding the member a
 * type error at every `switch` that forgot to handle it — and it is also the honest answer for the
 * one runtime case: there is no value to produce, and pretending otherwise would hide the bug.
 *
 * @param value The value the switch had not handled. Only ever reached if the types disagree.
 * @throws Always. There is no value of this type to return.
 */
export function unreachable(value: never): never {
  throw new Error(`Unreachable value reached: ${JSON.stringify(value)}`);
}
