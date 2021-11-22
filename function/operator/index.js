/**
 * @template R
 * @template T
 * @typedef {(prior: R) => (value: T) => R} BinaryOperator
 */

/** @type {(separator: string) => BinaryOperator<string, string>} */
const join = separator => prior => value => `${prior}${separator}${value}`

/** @type {(sum: number) => (value: number) => number} */
const addition = a => b => a + b

module.exports = {
    /** @readonly */
    join,
    /** @readonly */
    addition,
}