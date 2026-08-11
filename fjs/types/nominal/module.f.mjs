/**
 * Nominal typing helpers for branded TypeScript types.
 *
 * @module
 */

import { identity } from "../function/module.f.mjs"
/** @import { Nominal } from './types.ts' */

export const asNominal =
    /** @type {<N extends string, R extends string, B>(b: B) => Nominal<N, R, B>} */
    (identity)

export const asBase =
    /** @type {<T extends string, R extends string, B>(n: Nominal<T, R, B>) => B} */
    (identity)
