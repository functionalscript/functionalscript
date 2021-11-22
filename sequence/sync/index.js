const { pipe } = require('../../function')
const seq = require('..')

/** @type {<T>(a: Iterable<T>) => (b: Iterable<T>) => Iterable<T>} */
const concat = a => b => ({
    *[Symbol.iterator]() {
        yield *a
        yield *b
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

/** @type {<T, R>(s: seq.InclusiveScan<T, R>) => (c: Iterable<T>) => Iterable<R>} */
const inclusiveScan = s => c => concat([s.first])(scan(s.scan)(c))

/** @type {<T, R>(s: seq.InclusiveScan<T, R>) => (c: Iterable<T>) => R} */
const reduce = s => c => {
    let next = s.first
    for (const i of scan(s.scan)(c)) {
        next = i
    }
    return next
}

const entries = scan(seq.entries)

const sum = reduce(seq.sum)

const size = reduce(seq.size)

const join = pipe(seq.join)(reduce)

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
    scan,
    /** @readonly */
    inclusiveScan,
    /** @readonly */
    find,
}
