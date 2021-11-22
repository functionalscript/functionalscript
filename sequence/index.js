const { todo } = require('../dev')
const { id } = require('../function')

/**
 * @template R
 * @template T
 * @typedef {(prior: R) => (value: T) => R} BinaryOperator
 */

/**
 * @template T0
 * @template T1
 * @typedef {import('../array').Tuple2<T0, T1>} Tuple2
 */

/**
 * @template T
 * @template R
 * @typedef {Tuple2<R, Scan<T, R>>} ScanResult
 */

/**
 * @template T
 * @template R
 * @typedef {(value: T) => ScanResult<T, R>} Scan
 */

/**
 * @template T
 * @template R
 * @typedef {{
 *  readonly scan: Scan<T, R>
 *  readonly first: R
 * }} InclusiveScan
 */

/** @type {<R, T>(operator: BinaryOperator<R, T>) => (prior: R) => Scan<T, R>} */
const operatorScan = operator => {
    /** @typedef {typeof operator extends BinaryOperator<infer R, infer T> ? [R, T] : never} RT */
    /** @typedef {RT[0]} R */
    /** @typedef {RT[1]} T */
    /** @type {(prior: R) => Scan<T, R>} */
    const f = prior => value => {
        const result = operator(prior)(value)
        return [result, f(result)]
    }
    return f
} 

/** @type {<R, T>(operator: BinaryOperator<R, T>) => (first: R) => InclusiveScan<T, R>} */
const inclusiveOperatorScan = operator => first => ({
    scan: operatorScan(operator)(first),
    first,
})

/** 
 * @template T
 * @typedef {Tuple2<number, T>} Entry
 */

/** @type {(index: number) => <T>(value: T) => ScanResult<T, Entry<T>>} */
const createEntries = index => value => [[index, value], createEntries(index + 1)]

const entries = createEntries(0)

/** @type {(separator: string) => BinaryOperator<string, string>} */
const joinOperator = separator => prior => value => `${prior}${separator}${value}`

/** @type {(separator: string) => InclusiveScan<string, string>} */
const join = separator => ({
    scan: value => [value, operatorScan(joinOperator(separator))(value)],
    first: ''
})

/** @type {(sum: number) => (value: number) => number} */
const addition = a => b => a + b

const sum = inclusiveOperatorScan(addition)(0)

const size = inclusiveOperatorScan(a => () => a + 1)(0)

module.exports = {
    /** @readonly */
    inclusiveOperatorScan,
    /** @readonly */
    join,
    /** @readonly */
    sum,
    /** @readonly */
    size,
    /** @readonly */
    entries,
}
