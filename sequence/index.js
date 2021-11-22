const { todo } = require('../dev')
const { id } = require('../function')

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

/**
 * @template R
 * @template T
 * @typedef {(prior: R) => (value: T) => R} BinaryOperator
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
const joinOperation = separator => prior => value => `${prior}${separator}${value}`

/** @type {(separator: string) => InclusiveScan<string, string>} */
const join2 = separator => ({
    scan: value => [value, operatorScan(joinOperation(separator))(value)],
    first: ''
})

/** @type {(sum: number) => (value: number) => number} */
const addition = a => b => a + b

/** @type {InclusiveScan<number, number>} */
const sum2 = inclusiveOperatorScan(addition)(0)

////

/**
 * @template I
 * @template S
 * @template O
 * @typedef {{
 *  readonly merge: BinaryOperator<S, I>
 *  readonly result: (state: S) => O
 *  readonly init: S
 * }} Operation
 */

/** @type {(separator: string) => Operation<string, string|undefined, string>} */
const join = separator => ({ 
    merge: s => i => s === undefined ? i : `${s}${separator}${i}`, 
    init: undefined,
    result: s => s === undefined ? '' : s
})

/** @type {Operation<number, number, number>} */
const sum = { 
    merge: a => i => a + i, 
    result: id,
    init: 0,
}

/**
 * @type {{
 *  readonly merge: (counter: number) => () => number
 *  readonly result: (counter: number) => number
 *  readonly init: number
 * }}
 */
const size = {
    merge: counter => () => counter + 1,
    init: 0,
    result: id,
}

module.exports = {
    /** @readonly */
    join,
    join2,
    /** @readonly */
    sum,
    /** @readonly */
    size,
    /** @readonly */
    entries,
}
