/**
 * Nominal typing helpers for branded TypeScript types.
 *
 * @module
 */

import { identity } from "../function/module.f.mjs"

/**
 * Nominal type.
 *
 * It doesn't allow `===` between different nominal types.
 * It doesn't allow `<`, `>`, `<=`, `>=` comparisons at all.
 *
 * @template {string} N
 * @template {string} R
 * @template B
 * @typedef {symbol & {[k in N]: readonly[R, B]}} Nominal
 */

export const asNominal =
    /** @type {<N extends string, R extends string, B>(b: B) => Nominal<N, R, B>} */
    (identity)

/**
 * note: It should compiles into `identity` and no-ops at runtime.
 */
export const asBase =
    /** @type {<T extends string, R extends string, B>(n: Nominal<T, R, B>) => B} */
    (identity)
