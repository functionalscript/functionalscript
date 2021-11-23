const array = require('../array')
const option = require('../../option')

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
 * @typedef {(list: List<T>) => List<R>} Map
 */

/** @type {<T>(first: T) => Map<T, T>} */
const list = first => tail => () => [first, tail]

/** @type {<T>(first: T) => List<T>} */
const one = first => list(first)(empty)

/** @type {<T>(array: array.Array<T>) => List<T>} */
const fromArray = a => {
    /** @typedef {typeof a extends array.Array<infer T> ? T : never} T */
    /** @type {(index: number) => List<T>} */
    const listFrom = index => {
        /** @type {(value: readonly [T]) => Result<T>} */
        const result = ([value]) => list(value)(listFrom(index + 1))()
        return () => option.map(result)(array.at(a)(index))
    }
    return listFrom(0)
}

/** @type {<T>(list0: List<T>) => Map<T, T>} */
const concat = list0 => list1 => () => {
    /** @typedef {typeof list0 extends List<infer T> ? T : never} T */
    /** @type {(firstAntTail: FirstAndTail<T>) => Result<T>} */
    const result = ([first, tail]) => [first, concat(tail)(list1)]
    return option.map(result)(list0())
}

/** @type {<T, R>(f: (value: T) => List<R>) => Map<T, R>} */
const flatMap = f => {
    /** @typedef {typeof f extends (value: infer T) => List<infer R> ? [T, R] : never} TR */
    /** @typedef {TR[0]} T */
    /** @typedef {TR[1]} R */
    /** @type {(firstAntTail: FirstAndTail<T>) => Result<R>} */
    const result = ([first, tail]) => concat(f(first))(map(tail))()
    /** @type {(list: List<T>) => List<R>} */
    const map = list => () => option.map(result)(list())
    return map
}

/** @type {<T>(list: List<List<T>>) => List<T>} */
const flat = flatMap(i => i)

/** @type {<T, R>(f: (value: T) => R) => Map<T, R>} */
const map = f => flatMap(i => one(f(i)))

/** @type {<T>(f: (value: T) => boolean) => Map<T, T>} */
const filter = f => flatMap(i => f(i) ? one(i) : empty)

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
    list,
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
}