const { pipe } = require('../func')

/** @type {<T, R>(f: (value: T) => Promise<R>) => (c: AsyncIterable<T>) => AsyncIterable<R>} */
const map = f => c => ({
    async *[Symbol.asyncIterator]() {
        for await (const i of c) {
            yield f(i)
        }
    }
})

/** @type {<T>(c: AsyncIterable<AsyncIterable<T>>) => AsyncIterable<T>} */
const flatten = c => ({
    async *[Symbol.asyncIterator]() {
        for await (const i of c) {
            yield *i
        }
    }
})

/** @type {<T>(f: (value: T) => Promise<boolean>) => (c: AsyncIterable<T>) => AsyncIterable<T>} */
const filter = f => c => ({
    async *[Symbol.asyncIterator]() {
        for await (const i of c) {
            if (await f(i)) {
                yield i
            }
        }
    }
})

/** @type {<T, R>(f: (value: T) => AsyncIterable<R>) => (c: AsyncIterable<T>) => AsyncIterable<R>} */
const flatMap = f => pipe(map(async x => f(x)))(flatten)

/** 
 * @template A
 * @template T
 * @typedef {(accumulator: A) => (value: T) => Promise<A>} ReduceFn
 */

/** @type {<A, T>(f: ReduceFn<A, T>) => (init: A) => (c: AsyncIterable<T>) => Promise<A>} */
const reduce = reduceFn => init => async c => {
    let result = init
    for await (const i of c) {
        result = await reduceFn(result)(i)
    }
    return result
}

/** @type {<A, T>(f: ReduceFn<A, T>) => (init: A) => (c: AsyncIterable<T>) => AsyncIterable<A>} */
const exclusiveScan = reduceFn => init => c => ({
    async *[Symbol.asyncIterator]() {
        let result = init
        for await (const i of c) {
            result = await reduceFn(result)(i)
            yield result
        }
    }
})

/** @type {<A, T>(f: ReduceFn<A, T>) => (init: A) => (c: AsyncIterable<T>) => AsyncIterable<A>} */
const inclusiveScan = reduceFn => init => {
    const e = exclusiveScan(reduceFn)(init)
    return c => ({
        async *[Symbol.asyncIterator]() {
            yield init
            yield *e(c)
        }
    })
}

/** @type {<T>(iterable: Iterable<T>) => AsyncIterable<T>} */
const cast = iterable => ({
    async *[Symbol.asyncIterator]() {
        for (const i of iterable) {
            yield i
        }
    }
})

/** @type {(c: AsyncIterable<number>) => Promise<number>} */
const sum = reduce(a => async v => a + v)(0)

module.exports = {
    /** @readonly */
    cast,
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
    exclusiveScan,
    /** @readonly */
    inclusiveScan,
}