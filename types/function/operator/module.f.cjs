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
const join = separator => value => prior => `${prior}${separator}${value}`

/** @type {Reduce<string>} */
const concat = i => acc => `${acc}${i}`

/**
 * @template T
 * @template R
 * @typedef {(value: T) => R} Unary
 */

/** @type {Unary<boolean, boolean>} */
const logicalNot = v => !v

/**
 * @template T
 * @typedef {Binary<T, T, boolean>} Equal
 */

/** @type {<T>(a: T) => (b: T) => boolean} */
const strictEqual = a => b => a === b

/**
 * @template I,O
 * @typedef {(input: I) => readonly[O, Scan<I,O>]} Scan
 */

/**
 * @template I,S,O
 * @typedef {(prior: S) => (input: I) => readonly[O, S]} StateScan
 */

/** @type {<I, S, O>(op: StateScan<I, S, O>) => (prior: S) => Scan<I, O>} */
const stateScanToScan = op => prior => i => {
    const [o, s] = op(prior)(i)
    return [o, stateScanToScan(op)(s)]
}

/** @type {<I, O>(fold: Fold<I, O>) => (prior: O) => Scan<I, O>} */
const foldToScan = fold => prior => i => {
    const result = fold(i)(prior)
    return [result, foldToScan(fold)(result)]
}

/**
 * @template T
 * @typedef {Fold<T, T>} Reduce
 */

/** @type {<T>(fold: Reduce<T>) => Scan<T, T>} */
const reduceToScan = op => init => [init, foldToScan(op)(init)]

/** @type {Reduce<number>} */
const addition = a => b => a + b

/** @type {Reduce<number>} */
const min = a => b => a < b ? a : b

/** @type {Reduce<number>} */
const max = a => b => a > b ? a : b

const increment = addition(1)

const counter = () => increment

module.exports = {
    /** @readonly */
    join,
    /** @readonly */
    addition,
    /** @readonly */
    increment,
    /** @readonly */
    strictEqual,
    /** @readonly */
    logicalNot,
    /** @readonly */
    min,
    /** @readonly */
    max,
    /** @readonly */
    stateScanToScan,
    /** @readonly */
    foldToScan,
    /** @readonly */
    reduceToScan,
    /** @readonly */
    counter,
    /** @readonly */
    concat,
}