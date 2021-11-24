/**
 * @template A
 * @template B
 * @template R
 * @typedef {(a: A) => (b: B) => R} BinaryOperator
 */

/**
 * @template R
 * @template T
 * @typedef {BinaryOperator<R, T, R>} ReduceOperator
 */

/** @type {(separator: string) => ReduceOperator<string, string>} */
const join = separator => prior => value => `${prior}${separator}${value}`

/** @type {(sum: number) => (value: number) => number} */
const addition = a => b => a + b

/**
 * @template T
 * @template R
 * @typedef {(value: T) => R} UnaryOperator
 */

/** @type {(value: boolean) => boolean} */
const logicalNot = v => !v

/** @type {<T>(a: T) => (b: T) => boolean} */
const strictEqual = a => b => a === b

module.exports = {
    /** @readonly */
    join,
    /** @readonly */
    addition,
    /** @readonly */
    strictEqual,
    /** @readonly */
    logicalNot,
}