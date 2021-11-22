const { pipe } = require('../../function')
const seq = require('..')

/** 
 * @template T
 * @typedef {Promise<T>|T} PromiseOrValue
 */

/** 
 * @template T
 * @template R
 * @typedef {(f: (value: T) => PromiseOrValue<R>) => (c: AsyncIterable<T>) => AsyncIterable<R>} Map
 */

/**
 * @template T
 * @typedef {Iterable<T> | AsyncIterable<T>} AsyncOrSyncIterable
 */

/** @type {<T, R>(f: (value: T) => PromiseOrValue<R>) => (c: AsyncOrSyncIterable<T>) => AsyncIterable<R>} */
const map = f => c => ({
    async *[Symbol.asyncIterator]() {
        for await (const i of c) {
            yield f(i)
        }
    }
})

/** @type {<T>(c: AsyncOrSyncIterable<AsyncOrSyncIterable<T>>) => AsyncIterable<T>} */
const flatten = c => ({
    async *[Symbol.asyncIterator]() {
        for await (const i of c) {
            yield *i
        }
    }
})

/** @type {<T>(f: (value: T) => Promise<boolean>) => (c: AsyncOrSyncIterable<T>) => AsyncOrSyncIterable<T>} */
const filter = f => c => ({
    async *[Symbol.asyncIterator]() {
        for await (const i of c) {
            if (await f(i)) {
                yield i
            }
        }
    }
})

/** @type {<T, R>(f: (value: T) => AsyncOrSyncIterable<R>) => (c: AsyncOrSyncIterable<T>) => AsyncIterable<R>} */
const flatMap = f => pipe(map(f))(flatten)

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
const inclusiveScan = s => c => concat([s.first])(scan(s.scan)(c))

/** @type {<T, R>(is: seq.InclusiveScan<T, R>) => (c: AsyncOrSyncIterable<T>) => Promise<R>} */
const reduce = is => async c => {
    let next = is.first
    for await (const i of scan(is.scan)(c)) {
        next = i
    }
    return next
}

const sum = reduce(seq.sum)

const join = pipe(seq.join)(reduce)

const size = reduce(seq.size)

module.exports = {
    /** @readonly */
    concat,
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
    size,
    /** @readonly */
    join,
    /** @readonly */
    scan,
    /** @readonly */
    inclusiveScan,
}