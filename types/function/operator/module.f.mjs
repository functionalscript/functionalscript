// @ts-self-types="./module.f.d.mts"
/**
 * @template A
 * @template B
 * @template R
 * @typedef {(a: A) => (b: B) => R} Binary
 */

/**
 * @template I,O
 * @typedef {Binary<I, O, O>} Fold
 */

/** @type {(separator: string) => Reduce<string>} */
export const join = separator => value => prior => `${prior}${separator}${value}`

/** @type {Reduce<string>} */
export const concat = i => acc => `${acc}${i}`

/**
 * @template T
 * @template R
 * @typedef {(value: T) => R} Unary
 */

/** @type {Unary<boolean, boolean>} */
export const logicalNot = v => !v

/**
 * @template T
 * @typedef {Binary<T, T, boolean>} Equal
 */

/** @type {<T>(a: T) => (b: T) => boolean} */
export const strictEqual = a => b => a === b

/**
 * @template I,O
 * @typedef {(input: I) => readonly[O, Scan<I,O>]} Scan
 */

/**
 * @template I,S,O
 * @typedef {(prior: S) => (input: I) => readonly[O, S]} StateScan
 */

/** @type {<I, S, O>(op: StateScan<I, S, O>) => (prior: S) => Scan<I, O>} */
export const stateScanToScan = op => prior => i => {
    const [o, s] = op(prior)(i)
    return [o, stateScanToScan(op)(s)]
}

/** @type {<I, O>(fold: Fold<I, O>) => (prior: O) => Scan<I, O>} */
export const foldToScan = fold => prior => i => {
    const result = fold(i)(prior)
    return [result, foldToScan(fold)(result)]
}

/**
 * @template T
 * @typedef {Fold<T, T>} Reduce
 */

/** @type {<T>(fold: Reduce<T>) => Scan<T, T>} */
export const reduceToScan = op => init => [init, foldToScan(op)(init)]

/** @type {Reduce<number>} */
export const addition = a => b => a + b

/** @type {Reduce<number>} */
export const min = a => b => a < b ? a : b

/** @type {Reduce<number>} */
export const max = a => b => a > b ? a : b

export const increment = addition(1)

export const counter = () => increment
