/**
 * @template A
 * @template B
 * @template R
 * @typedef {(a: A) => (b: B) => R} Binary
 */

/**
 * @template I,O
 * @typedef {Binary<I, O, O>} Reduce
 */

/** @type {(separator: string) => Fold<string>} */
const join = separator => value => prior => `${prior}${separator}${value}`

/** @type {Fold<string>} */
const concat = i => acc => `${acc}${i}`

/** @type {Fold<number>} */
const addition = a => b => a + b

const increment = addition(1)

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

/** @type {Fold<number>} */
const min = a => b => a < b ? a : b

/** @type {Fold<number>} */
const max = a => b => a > b ? a : b

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

/** @type {<I, O>(reduce: Reduce<I, O>) => (prior: O) => Scan<I, O>} */
const reduceToScan = reduce => prior => i => {
    const result = reduce(i)(prior)
    return [result, reduceToScan(reduce)(result)]
}

/**
 * @template T
 * @typedef {Reduce<T, T>} Fold
 */

/** @type {<T>(fold: Fold<T>) => Scan<T, T>} */
const foldToScan = op => init => [init, reduceToScan(op)(init)]

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
    reduceToScan,
    /** @readonly */
    foldToScan,
    /** @readonly */
    counter,
    /** @readonly */
    concat,
}