/**
 * Compile-time witnesses for exhaustive switch checks.
 *
 * A switch that returns in every case has no way to say so in its own type, so the check is written
 * into the code instead: after the switch, the value — which the compiler has narrowed to `never`
 * precisely when no case was missed — is assigned to {@link ExhaustiveVoid}, and
 * {@link ExhaustiveCheckDone} is returned to satisfy the function's declared return type. Either
 * half quietly missing is a compile error rather than a silent fall-through.
 */

/**
 * The only type a completed exhaustive check may produce.
 *
 * It is deliberately the single value `true`, not `boolean` or `void`: the compiler accepts
 * {@link ExhaustiveCheckDone} for it, plus exactly what it can prove is `never` — and a
 * discriminated value is `never` after a switch precisely when every case has been ruled out.
 */
export type ExhaustiveVoid = true;

/**
 * Returned after the check, to say the switch covered every case of the union.
 *
 * It pairs with the declaration `const exhaustive: ExhaustiveVoid = value;` immediately before it:
 * the declaration is the check, this constant is the return.
 */
export const ExhaustiveCheckDone: ExhaustiveVoid = true;
