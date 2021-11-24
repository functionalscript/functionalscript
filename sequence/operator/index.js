const op = require('../../function/operator')

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
 * @typedef {Tuple2<R, Scan<T, R>>} ExclusiveScan
 */

/** @type {<R, T>(operator: op.ReduceOperator<R, T>) => (prior: R) => Scan<T, R>} */
const scan = operator => {
    /** @typedef {typeof operator extends op.ReduceOperator<infer R, infer T> ? [R, T] : never} RT */
    /** @typedef {RT[0]} R */
    /** @typedef {RT[1]} T */
    /** @type {(prior: R) => Scan<T, R>} */
    const f = prior => value => {
        const result = operator(prior)(value)
        return [result, f(result)]
    }
    return f
} 

/** @type {<R, T>(operator: op.ReduceOperator<R, T>) => (first: R) => ExclusiveScan<T, R>} */
const exclusiveScan = operator => first => [first, scan(operator)(first)]

/** 
 * @template T
 * @typedef {Tuple2<number, T>} Entry
 */

/** @type {(index: number) => <T>(value: T) => ScanResult<T, Entry<T>>} */
const createEntries = index => value => [[index, value], createEntries(index + 1)]

const entries = createEntries(0)

/** @type {(separator: string) => ExclusiveScan<string, string>} */
const join = separator => ['', value => [value, scan(op.join(separator))(value)]]

const sum = exclusiveScan(op.addition)(0)

/** @type {(a: number) => () => number} */
const counter = a => () => a + 1

const length = exclusiveScan(counter)(0)

/**
 * @template T
 * @template R
 * @typedef {(value: T) => R} Func
 */

/** @type {<T, R, X>(flatMap: (f: Func<T, readonly[R]>) => X) => (f: Func<T, R>) =>X} */
const map = flatMap => f => flatMap(x => [f(x)])

/** @type {<T, X>(flatMap: (f: Func<T, readonly[T]|[]>) => X) => (f: Func<T, boolean>) =>X} */
const filter = flatMap => f => flatMap(x => f(x) ? [x] : [])

module.exports = {
    /** @readonly */
    exclusiveScan,
    /** @readonly */
    scan,
    /** @readonly */
    join,
    /** @readonly */
    sum,
    /** @readonly */
    length,
    /** @readonly */
    entries,
    /** @readonly */
    map,
    /** @readonly */
    filter,
}
