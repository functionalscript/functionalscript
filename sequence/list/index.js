const array = require('../array')
const base = require('..')
const { pipe } = require('../../function')
const { logicalNot, strictEqual } = require('../../function/operator')

/**
 * @template T
 * @typedef {() => Result<T>} ListFunc
 */

/**
 * @template T
 * @typedef {readonly [List<T>, List<T>]} Concat
 */

/**
 * Use `next` function to get `first` and `tail` of the list.
 * 
 * Please note that the list also contains `Concat<T>. We need this as 
 * a workaround because modern JavaScript implementations don't support 
 * ES6 TCO (Tail Call Optimization).
 *
 * Without this wotkaround we may have a stack overflow if a list
 * contains a lot of concateneted lists. 
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

/** @type {<T>(list: List<T>) => T|undefined} */
const first = list => {
    const result = next(list)
    if (result === undefined) { return undefined }
    return result[0]
}

/**
 * @template T
 * @template R
 * @typedef {(list: List<T>) => List<R>} ListMap
 */

/**
 * @template T
 * @template R
 * @typedef {(list: List<T>) => R} ListReduce
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

/** @type {<T, R>(f: (value: T) => R|undefined) => (value: T) => List<R>} */
const filterMapFunc = f => i => {
    const result = f(i)
    if (result === undefined) { return empty }
    return one(result)
}

/** @type {<T, R>(f: (value: T) => R|undefined) => ListMap<T, R>} */
const filterMap = f => flatMap(filterMapFunc(f)) 

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

/** @type {(n: number) => <T>(input: List<T>) => List<T>} */
const drop = n => input => () => {
    let iN = n
    let iInput = input
    while (true) {
        const result = next(iInput)
        if (iN <= 0 || result === undefined) { return result }
        iN = iN - 1
        iInput = result[1]
    }
}

/** @type {(n: number) => <T>(input: List<T>) => T|undefined} */
const at = n => input => first(drop(n)(input))

/** @type {<T>(f: (value: T) => boolean) => ListReduce<T, T|undefined>} */
const find = f => input => first(filter(f)(input))

/** @type {<T>(f: (value: T) => boolean) => ListReduce<T, boolean>} */
const some = f => input => find(x => x)(map(f)(input)) !== undefined

/** @type {<T>(value: T) => ListReduce<T, boolean>} */
const includes = value => some(strictEqual(value))

/** @type {<T>(f: (value: T) => boolean) => ListReduce<T, boolean>} */
const every = f => input => !some(pipe(f)(logicalNot))(input)

/** @type {<T>(list: List<T>) => Iterable<T>} */
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
    at,
    /** @readonly */
    concat,
    /** @readonly */
    first,
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
    filterMap,
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
    drop,
    /** @readonly */
    find,
    /** @readonly */
    takeWhile,
    /** @readonly */
    some,
    /** @readonly */
    every,
    /** @readonly */
    includes,
}