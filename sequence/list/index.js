const array = require('../array')
const option = require('../../option')
const base = require('..')
const { pipe } = require('../../function')
const { todo } = require('../../dev')

/**
 * @template T
 * @typedef {() => Result<T>} ListFunc
 */

/**
 * We need this workaround because modern JavaScript implementations
 * don't support ES6 TCO (Tail Call Optimization)
 * 
 * Without this wotkaround we may have a stack overflow if a list
 * contains a lot of concateneted lists.
 * 
 * @template T
 * @typedef {readonly [List<T>, List<T>]} Concat
 */

/**
 * @template T
 * @typedef { ListFunc<T> | Concat<T>} List
 */

/**
 * @template T
 * @typedef {FirstAndTail<T>|undefined} Result<T>
 */

/**
 * @template T
 * @typedef {array.Tuple2<T, List<T>>} FirstAndTail
 */

const empty = () => undefined

/** @type {<T>(list: List<T>) => Result<T>} */
const get = list => {
    let i = list
    while (true) {
        if (typeof i === 'function') { return i() }
        const [a, b] = i
        if (typeof a === 'function') { 
            const result = a()
            if (result !== undefined) { 
                return [result[0], [result[1], b]]
            }
            i = b
        } else {
            i = [a[0], [a[1], b]]
        }
    }
}

/**
 * @template T
 * @template R
 * @typedef {(list: List<T>) => List<R>} ListMap
 */

/** @type {<T>(first: T) => List<T>} */
const one = first => () => [first, empty]

/** @type {<T>(array: array.Array<T>) => List<T>} */
const fromArray = a => {
    /** @typedef {typeof a extends array.Array<infer T> ? T : never} T */
    /** @type {(index: number) => List<T>} */
    const at = index => () => {
        const result = array.at(index)(a)
        if (result === undefined) { return undefined }
        return [result[0], at(index + 1)]
    }
    return at(0)
}

/** @type {<T>(list0: List<T>) => ListMap<T, T>} */
const concat = a => b => [a, b]

/** @type {<T, R>(f: (value: T) => List<R>) => ListMap<T, R>} */
const flatMap = f => input => () => {
    let i = input
    while (true) { 
        const result = get(i)
        if (result === undefined) { return undefined }
        const [first, tail] = result
        const firstResult = get(f(first)) 
        if (firstResult !== undefined) {
            const [firstFirst, firstTail] = firstResult
            return [firstFirst, concat(firstTail)(flatMap(f)(tail))]
        }
        i = tail
    }
}

/** @type {<T>(list: List<List<T>>) => List<T>} */
const flat = flatMap(i => i)

/** @type {<T, R>(f: (value: T) => R) => ListMap<T, R>} */
const map = f => flatMap(i => one(f(i)))

/** @type {<T>(f: (value: T) => boolean) => ListMap<T, T>} */
const filter = f => flatMap(i => f(i) ? one(i) : empty)

/** @type {<T, R>(s: base.Scan<T, R>) => ListMap<T, R>} */
const scan = s => input => () => {
    /** @typedef {typeof s extends base.Scan<infer T, infer R> ? [T, R] : never} TR */
    /** @typedef {TR[0]} T */
    /** @typedef {TR[1]} R */
    /** @type {(firstAndTail: FirstAndTail<T>) => Result<R>} */
    const defined = ([first, tail]) => {
        const [newFirst, newS] = s(first)
        return [newFirst, scan(newS)(tail)]
    }
    return option.map(defined)(get(input))
}

/** @type {<T, R>(s: base.InclusiveScan<T, R>) => ListMap<T, R>} */
const inclusiveScan = ([first, s]) => input => () => [first, scan(s)(input)]

/** @type {<T>(def: T) => (input: List<T>) => T} */
const last = def => input => {
    let r = def
    let i = input    
    while (true) {
        const result = get(i)
        if (result === undefined) {
            return r
        }
        r = result[0]
        i = result[1]
    }
    return r
}

/** @type {<T, R>(s: base.InclusiveScan<T, R>) => (input: List<T>) => R} */
const reduce = ([first, s]) => input => last(first)(scan(s)(input))

const entries = scan(base.entries)

const sum = reduce(base.sum)

const length = reduce(base.length)

const join = pipe(base.join)(reduce)

/** @type {<T>(f: (value: T) => boolean) => ListMap<T, T>} */
const takeWhile = f => input => () => {
    const result = get(input)
    if (result === undefined || !f(result[0])) { return undefined }
    return result
}

/** @type {<T>(f: (value: T) => boolean) => (input: List<T>) => T|undefined} */
const find = f => input => {
    /** @typedef {typeof f extends (value: infer T) => boolean ? T : never} T */
    /** @type {(result: FirstAndTail<T>) => T} */
    const defined = ([first]) => first
    return option.map(defined)(get(filter(f)(input)))
}

/**
 * Note: probably, it's possible to implement using the `scan` concept.
 * @type {<T>(list: List<T>) => Iterable<T>} 
 */
const iterable = list => ({
    *[Symbol.iterator]() {
        let i = list
        while (true) {
            const result = get(i)
            if (result === undefined) { return }
            yield result[0]
            i = result[1]
        }
    }
})

module.exports = {
    /** @readonly */
    get,
    /** @readonly */
    one,
    /** @readonly */
    empty,
    /** @readonly */
    concat,
    /** @readonly */
    fromArray,
    /** @readonly */
    iterable,
    /** @readonly */
    flatMap,
    /** @readonly */
    flat,
    /** @readonly */
    map,
    /** @readonly */
    filter,
    /** @readonly */
    scan,
    /** @readonly */
    inclusiveScan,
    /** @readonly */
    last,
    /** @readonly */
    reduce,
    /** @readonly */
    entries,
    /** @readonly */
    sum,
    /** @readonly */
    join,
    /** @readonly */
    length,
    /** @readonly */
    find,
}