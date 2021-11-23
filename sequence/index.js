const op = require('../function/operator')
const { id } = require('../function')

/**
 * @template T0
 * @template T1
 * @typedef {import('./array').Tuple2<T0, T1>} Tuple2
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

/** @type {<R, T>(operator: op.BinaryOperator<R, T>) => (prior: R) => Scan<T, R>} */
const scan = operator => {
    /** @typedef {typeof operator extends op.BinaryOperator<infer R, infer T> ? [R, T] : never} RT */
    /** @typedef {RT[0]} R */
    /** @typedef {RT[1]} T */
    /** @type {(prior: R) => Scan<T, R>} */
    const f = prior => value => {
        const result = operator(prior)(value)
        return [result, f(result)]
    }
    return f
} 

/** @type {<R, T>(operator: op.BinaryOperator<R, T>) => (first: R) => InclusiveScan<T, R>} */
const inclusiveScan = operator => first => ({
    scan: scan(operator)(first),
    first,
})

/** 
 * @template T
 * @typedef {Tuple2<number, T>} Entry
 */

/** @type {(index: number) => <T>(value: T) => ScanResult<T, Entry<T>>} */
const createEntries = index => value => [[index, value], createEntries(index + 1)]

const entries = createEntries(0)

/** @type {(separator: string) => InclusiveScan<string, string>} */
const join = separator => ({
    scan: value => [value, scan(op.join(separator))(value)],
    first: ''
})

const sum = inclusiveScan(op.addition)(0)

const size = inclusiveScan(a => () => a + 1)(0)

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
    inclusiveScan,
    /** @readonly */
    scan,
    /** @readonly */
    join,
    /** @readonly */
    sum,
    /** @readonly */
    size,
    /** @readonly */
    entries,
    /** @readonly */
    map,
    /** @readonly */
    filter,
}
