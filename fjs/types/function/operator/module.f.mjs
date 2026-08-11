/**
 * Common higher-order operator type aliases.
 *
 * @module
 */

/** @import { Fold, Reduce, Scan, StateScan, Unary } from './types.ts' */

/** @type {(separator: string) => Reduce<string>} */
export const join = separator => value => prior =>
    `${prior}${separator}${value}`

/** @type {Reduce<string>} */
export const concat = i => acc => `${acc}${i}`

/** @type {Unary<boolean, boolean>} */
export const logicalNot = v => !v

/**
 * See also `Object.is` which should be used for deep comparison instead of the `structEqual`.
 * TODO: add `binaryEqual = a => b => Object.is(a, b)`.
 *
 * @type {<T>(a: T) => (b: T) => boolean}
 */
export const strictEqual = a => b => a === b

/** @type {<I, S, O>(op: StateScan<I, S, O>) => (prior: S) => Scan<I, O>} */
export const stateScanToScan = op => prior => i => {
    const [o, s] = op(i, prior)
    return [o, stateScanToScan(op)(s)]
}

/** @type {<I, O>(fold: Fold<I, O>) => (prior: O) => Scan<I, O>} */
export const foldToScan = fold => prior => i => {
    const result = fold(i)(prior)
    return [result, foldToScan(fold)(result)]
}

/** @type {<T>(op: Reduce<T>) => Scan<T, T>} */
export const reduceToScan = op => init =>
    [init, foldToScan(op)(init)]

/**
 * TODO: We should have one function for `number` | `bigint` and `string`.
 *       We can use the same approach as we use for comparing items,
 *       see `Cmp1` and `Cmp2` types.
 *
 * @type {Reduce<number>}
 */
export const addition = a => b => a + b

/** @type {Unary<number, number>} */
export const increment = addition(1)

export const counter = () => increment
