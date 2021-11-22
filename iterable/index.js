const { pipe } = require('../function')
const seq = require('../sequence')

/**
 * @template S
 * @template T
 * @typedef {(_: S) => (_: T) => S} Merge
 */

/** @type {<T, R>(merge: Merge<R, T>) => (init: R) => (_: Iterable<T>) => R} */
const reduce = merge => init => c => {
    let result = init
    for (const i of c) {
        result = merge(result)(i)
    }
    return result
}

/** @type {<T>(a: Iterable<T>) => (b: Iterable<T>) => Iterable<T>} */
const concat = a => b => ({
    *[Symbol.iterator]() {
        yield *a
        yield *b
    }
})

/** @type {<A, T>(merge: Merge<A, T>) => (init: A) => (c: Iterable<T>) => Iterable<A>} */
const exclusiveScan = merge => init => c => ({
    *[Symbol.iterator]() {
        let result = init
        for (const i of c) {
            result = merge(result)(i)
            yield result
        }
    }
})

/** @type {<A, T>(merge: Merge<A, T>) => (init: A) => (c: Iterable<T>) => Iterable<A>} */
const inclusiveScan = merge => init => c => concat([init])(exclusiveScan(merge)(init)(c))

/** @type {<T, R>(es: seq.Scan<T, R>) => (c: Iterable<T>) => Iterable<R>} */
const applyScan = es => c => ({
    *[Symbol.iterator]() {
        let ies = es
        for (const i of c) {
            const result = ies(i)
            ies = result[1]
            yield result[0]
        }
    }
})

/** @type {<T, R>(is: seq.InclusiveScan<T, R>) => (c: Iterable<T>) => Iterable<R>} */
const applyInclusiveScan = ({scan, first}) => c => concat([first])(applyScan(scan)(c))

const entries = applyScan(seq.entries)

/** @type {<I, S, R>(op: seq.Operation<I, S, R>) => (_: Iterable<I>) => R} */
const apply = ({ merge, init, result }) => pipe(reduce(merge)(init))(result)

const sum = apply(seq.sum)

const size = apply(seq.size)

const join = pipe(seq.join)(apply)

/** @type {<T, R>(f: (value: T) => R) => (c: Iterable<T>) => Iterable<R>} */
const map = f => c => ({
    *[Symbol.iterator]() {
        for (const i of c) {
            yield f(i)
        }
    }
})

/** @type {<T>(_: (_: T) => boolean) => (_: Iterable<T>) => T|undefined} */
const find = f => c => {
    for (const i of c) {
        if (f(i)) {
            return i
        }
    }
    return undefined
}

module.exports = {
    /** @readonly */
    apply,

    /** @readonly */
    reduce,

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
    exclusiveScan,

    /** @readonly */
    inclusiveScan,

    /** @readonly */
    find,
}
