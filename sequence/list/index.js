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
 * @template T
 * @typedef {readonly [List<T>, List<T>]} Concat
 */

/**
 * Please note that the list also contains `Concat<T>. We need this as 
 * a workaround because modern JavaScript implementations don't support 
 * ES6 TCO (Tail Call Optimization).
 *
 * Without this wotkaround we may have a stack overflow if a list
 * contains a lot of concateneted lists. Use `next` function to extract 
 * a list. 
 *
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

/** @type {<F, T>(a: readonly[F, List<T>]) => (b: List<T>) => readonly[F, List<T>]} */
const norm = ([a0, a1]) => b => [a0, [a1, b]]

/** @type {<T>(list: List<T>) => Result<T>} */
const next = list => {
    let i = list
    while (true) {
        if (typeof i === 'function') { return i() }
        const [a, b] = i
        if (typeof a === 'function') { 
            const result = a()
            if (result !== undefined) { 
                return norm(result)(b)
            }
            i = b
        } else {
            i = norm(a)(b)
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
        const result = next(i)
        if (result === undefined) { return undefined }
        const [first, tail] = result
        const firstResult = next(f(first)) 
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
    const result = next(input)
    if (result === undefined) {
        return result
    }
    const [first, tail] = result
    const [newFirst, newS] = s(first)
    return [newFirst, scan(newS)(tail)]
}

/** @type {<T, R>(s: base.InclusiveScan<T, R>) => ListMap<T, R>} */
const inclusiveScan = ([first, s]) => input => () => [first, scan(s)(input)]

/** @type {<T>(def: T) => (input: List<T>) => T} */
const last = def => input => {
    let r = def
    let i = input    
    while (true) {
        const result = next(i)
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
    const result = next(input)
    if (result === undefined || !f(result[0])) { return undefined }
    return result
}

/** @type {<T>(f: (value: T) => boolean) => (input: List<T>) => T|undefined} */
const find = f => input => {
    const result = next(filter(f)(input))
    if (result === undefined) { return undefined }
    return result[0]
}

/**
 * Note: probably, it's possible to implement using the `scan` concept.
 * @type {<T>(list: List<T>) => Iterable<T>} 
 */
const iterable = list => ({
    *[Symbol.iterator]() {
        let i = list
        while (true) {
            const result = next(i)
            if (result === undefined) { return }
            yield result[0]
            i = result[1]
        }
    }
})

module.exports = {
    /** @readonly */
    next,
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
    /** @readonly */
    takeWhile,
}