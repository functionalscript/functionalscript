const { pipe } = require('../../function')
const seq = require('..')

/**
 * @template T 
 * @typedef {Promise<T>|T} PromiseOrValue 
 */

/**
 * @template T
 * @typedef {Iterable<T> | AsyncIterable<T>} AsyncOrSyncIterable
 */

/** @type {<T>(c: AsyncOrSyncIterable<AsyncOrSyncIterable<T>>) => AsyncIterable<T>} */
const flat = c => ({
    async *[Symbol.asyncIterator]() {
        for await (const i of c) {
            yield* i
        }
    }
})

/** @type {<T, R>(f: (value: T) => AsyncOrSyncIterable<R>) => (c: AsyncOrSyncIterable<T>) => AsyncIterable<R>} */
const flatMap = f => c => ({
    async *[Symbol.asyncIterator]() {
        for await (const i of c) {
            yield* await f(i)
        }
    }
})

/** @type {<T, R>(f: (value: T) => R) => (c: AsyncOrSyncIterable<T>) => AsyncIterable<R>} */
const map = seq.map(flatMap)

/** @type {<T>(f: (value: T) => boolean) => (c: AsyncOrSyncIterable<T>) => AsyncOrSyncIterable<T>} */
const filter = seq.filter(flatMap)

/** @type {<T>(a: AsyncOrSyncIterable<T>) => (b: AsyncOrSyncIterable<T>) => AsyncIterable<T>} */
const concat = a => b => ({
    async *[Symbol.asyncIterator]() {
        yield* a
        yield* b
    }
})

/** @type {<T, R>(s: seq.Scan<T, R>) => (c: AsyncOrSyncIterable<T>) => AsyncIterable<R>} */
const scan = s => c => ({
    async *[Symbol.asyncIterator]() {
        let next = s
        for await (const i of c) {
            const result = next(i)
            next = result[1]
            yield result[0]
        }
    }
})

/** @type {<T, R>(s: seq.InclusiveScan<T, R>) => (c: AsyncOrSyncIterable<T>) => AsyncIterable<R>} */
const inclusiveScan = ([first, s]) => c => concat([first])(scan(s)(c))

/** @type {<T, R>(is: seq.InclusiveScan<T, R>) => (c: AsyncOrSyncIterable<T>) => Promise<R>} */
const reduce = ([first, s]) => async c => {
    let next = first
    for await (const i of scan(s)(c)) {
        next = i
    }
    return next
}

const sum = reduce(seq.sum)

const join = pipe(seq.join)(reduce)

const length = reduce(seq.length)

/** @type {<T>(f: (value: T) => boolean) => (c: AsyncOrSyncIterable<T>) => AsyncIterable<T>} */
const takeWhile = f => c => ({
    async *[Symbol.asyncIterator]() {
        for await (const i of c) {
            if (!f(i)) { return }
            yield i
        }
    }
})

module.exports = {
    /** @readonly */
    concat,
    /** @readonly */
    flat,
    /** @readonly */
    map,
    /** @readonly */
    filter,
    /** @readonly */
    flatMap,
    /** @readonly */
    reduce,
    /** @readonly */
    sum,
    /** @readonly */
    length,
    /** @readonly */
    join,
    /** @readonly */
    scan,
    /** @readonly */
    inclusiveScan,
    /** @readonly */
    takeWhile,
}