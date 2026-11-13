/**
 * The values of the IR on the host, as the host proofs pass them to
 * [`testlib.mjs`](./testlib.mjs) and get them back. They are here and not
 * in `private.ts` because the declaration of `testlib.mjs` names them, and
 * it ships in the package.
 *
 * @module
 */

/**
 * A value of the IR on the host, as the host proofs pass it: an integer as
 * a `bigint`, a float as a `number`, and a `bool` as a `boolean`.
 */
export type _Value = bigint | number | boolean

/** A function's JavaScript twin, on its arguments in their order. */
export type _Twin = (xs: readonly _Value[]) => _Value
