const { compose } = require('../../function')
const seq = require('../operator')

/** @type {<T>(a: Iterable<T>) => (b: Iterable<T>) => Iterable<T>} */
const concat = a => b => ({
    *[Symbol.iterator]() {
        yield* a
        yield* b
    }
})

/** @type {<T, R>(s: seq.Scan<T, R>) => (c: Iterable<T>) => Iterable<R>} */
const scan = s => c => ({
    *[Symbol.iterator]() {
        let next = s
        for (const i of c) {
            const result = next(i)
            next = result[1]
            yield result[0]
        }
    }
})

/** @type {<T, R>(s: seq.ExclusiveScan<T, R>) => (c: Iterable<T>) => Iterable<R>} */
const exclusiveScan = ([first, s]) => c => concat([first])(scan(s)(c))

/** @type {<T, R>(s: seq.ExclusiveScan<T, R>) => (c: Iterable<T>) => R} */
const reduce = ([first, s]) => c => {
    let next = first
    for (const i of scan(s)(c)) {
        next = i
    }
    return next
}

const entries = scan(seq.entries)

const sum = reduce(seq.sum)

const length = reduce(seq.length)

const join = compose(reduce)(seq.join)

/** @type {<T, R>(f: (value: T) => Iterable<R>) => (c: Iterable<T>) => Iterable<R>} */
const flatMap = f => c => ({
    *[Symbol.iterator]() {
        for (const i of c) {
            yield* f(i)
        }
    }
})

/** @type {<T, R>(f: (value: T) => R) => (c: Iterable<T>) => Iterable<R>} */
const map = seq.map(flatMap)

/** @type {<T>(f: (value: T) => boolean) => (c: Iterable<T>) => Iterable<T>} */
const filter = seq.filter(flatMap)

/** @type {<T>(c: Iterable<Iterable<T>>) => Iterable<T>} */
const flat = flatMap(x => x)

/** @type {<T>(f: (value: T) => boolean) => (c: Iterable<T>) => Iterable<T>} */
const takeWhile = f => c => ({
    *[Symbol.iterator]() {
        for (const i of c) {
            if (!f(i)) { return }
            yield i
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
    reduce,
    /** @readonly */
    join,
    /** @readonly */
    sum,
    /** @readonly */
    length,
    /** @readonly */
    entries,
    /** @readonly */
    scan,
    /** @readonly */
    exclusiveScan,
    /** @readonly */
    flatMap,
    /** @readonly */
    map,
    /** @readonly */
    filter,
    /** @readonly */
    flat,
    /** @readonly */
    takeWhile,
    /** @readonly */
    find,
}
