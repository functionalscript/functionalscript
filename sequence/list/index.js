const array = require('../array')
const option = require('../../option')
const base = require('..')
const { pipe } = require('../../function')
const { todo } = require('../../dev')

/**
 * @template T
 * @typedef {() => Result<T>} List
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

/**
 * Note: the function is not completly lazy.
 *       it calls `a()` as soon as `a` and `b` are provided.
 *       Othrewise we may have a stack overflow if a list 
 *       contains a lot of concateneted empty lists.
 *       And we can't relay on ES6 TCO (Tail Call Optimization) 
 *       because it's not supported by Chrome and Firefox.
 * @type {<T>(list0: List<T>) => ListMap<T, T>} 
 */
const concat = a => b => {
    const result = a()
    if (result !== undefined) {
        const [first, tail] = result
        return () => [first, concat(tail)(b)]
    }
    return b
}

/** @type {<T, R>(f: (value: T) => List<R>) => ListMap<T, R>} */
const flatMap = f => input => () => {
    let i = input
    while (true) { 
        const result = i()
        if (result === undefined) { return undefined }
        const [first, tail] = result
        const firstResult = f(first)() 
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
    return option.map(defined)(input())
}

/** @type {<T, R>(s: base.InclusiveScan<T, R>) => ListMap<T, R>} */
const inclusiveScan = ([first, s]) => input => () => [first, scan(s)(input)]

/** @type {<T>(def: T) => (input: List<T>) => T} */
const last = def => input => {
    let i = input()
    let r = def
    while (i !== undefined) {
        r = i[0]
        i = i[1]()
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
    const result = input()
    if (result === undefined || !f(result[0])) { return undefined }
    return result
}

/** @type {<T>(f: (value: T) => boolean) => (input: List<T>) => T|undefined} */
const find = f => input => {
    /** @typedef {typeof f extends (value: infer T) => boolean ? T : never} T */
    /** @type {(result: FirstAndTail<T>) => T} */
    const defined = ([first]) => first
    return option.map(defined)(filter(f)(input)())
}

/**
 * Note: probably, it's possible to implement using the `scan` concept.
 * @type {<T>(list: List<T>) => Iterable<T>} 
 */
const iterable = list => ({
    *[Symbol.iterator]() {
        let result = list()
        while (result !== undefined) {
            yield result[0]
            result = result[1]()
        }
    }
})

module.exports = {
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