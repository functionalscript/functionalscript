/**
 * The values of the IR on the host, as the host proofs pass them to
 * [`testlib.mjs`](./testlib.mjs) and get them back. They are here and not
 * in `private.ts` because the declaration of `testlib.mjs` names them, and
 * it ships in the package.
 *
 * @module
 */

/**
 * A value of a sealed type, as the host proofs pass it: the FunctionalScript
 * value whose handle the function gets.
 */
export type _Any = { readonly any: unknown }

/**
 * A value of the IR on the host, as the host proofs pass it: an integer as
 * a `bigint`, a float as a `number`, a `bool` as a `boolean`, and a value
 * of `any` as the value it holds.
 */
export type _Value = bigint | number | boolean | _Any

/** A function's JavaScript twin, on its arguments in their order. */
export type _Twin = (xs: readonly _Value[]) => _Value
