/**
 * @template A
 * @template B
 * @template R
 * @typedef {(a: A) => (b: B) => R} Binary
 */

/**
 * @template I,O
 * @typedef {Binary<I, O, O>} FoldT
 */

/** @type {(separator: string) => Fold<string>} */
const join = separator => value => prior => `${prior}${separator}${value}`

/** @type {Fold<string>} */
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

/** @type {<I, O>(fold: FoldT<I, O>) => (prior: O) => Scan<I, O>} */
const foldTToScan = fold => prior => i => {
    const result = fold(i)(prior)
    return [result, foldTToScan(fold)(result)]
}

/**
 * @template T
 * @typedef {FoldT<T, T>} Fold
 */

/** @type {<T>(fold: Fold<T>) => Scan<T, T>} */
const foldToScan = op => init => [init, foldTToScan(op)(init)]

/** @type {Fold<number>} */
const addition = a => b => a + b

/** @type {Fold<number>} */
const min = a => b => a < b ? a : b

/** @type {Fold<number>} */
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
    foldTToScan,
    /** @readonly */
    foldToScan,
    /** @readonly */
    counter,
    /** @readonly */
    concat,
}