const { pipe } = require('../../function')
const seq = require('../../sequence')

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
 * @typedef {Iterable<T> | AsyncIterable<T>} AnyIterable
 */

/** @type {<T, R>(f: (value: T) => PromiseOrValue<R>) => (c: AnyIterable<T>) => AsyncIterable<R>} */
const map = f => c => ({
    async *[Symbol.asyncIterator]() {
        for await (const i of c) {
            yield f(i)
        }
    }
})

/** @type {<T>(c: AnyIterable<AnyIterable<T>>) => AsyncIterable<T>} */
const flatten = c => ({
    async *[Symbol.asyncIterator]() {
        for await (const i of c) {
            yield *i
        }
    }
})

/** @type {<T>(f: (value: T) => Promise<boolean>) => (c: AnyIterable<T>) => AnyIterable<T>} */
const filter = f => c => ({
    async *[Symbol.asyncIterator]() {
        for await (const i of c) {
            if (await f(i)) {
                yield i
            }
        }
    }
})

/** @type {<T, R>(f: (value: T) => AnyIterable<R>) => (c: AnyIterable<T>) => AsyncIterable<R>} */
const flatMap = f => pipe(map(f))(flatten)

/** 
 * @template A
 * @template T
 * @typedef {(accumulator: A) => (value: T) => PromiseOrValue<A>} Merge
 */

/** @type {<A, T>(merge: Merge<A, T>) => (init: A) => (c: AnyIterable<T>) => Promise<A>} */
const reduce = merge => init => async c => {
    let result = init
    for await (const i of c) {
        result = await merge(result)(i)
    }
    return result
}

/** @type {<T>(a: AnyIterable<T>) => (b: AnyIterable<T>) => AsyncIterable<T>} */
const concat = a => b => ({
    async *[Symbol.asyncIterator]() {
        yield* a
        yield* b
    }
})

/** @type {<A, T>(merg: Merge<A, T>) => (init: A) => (c: AnyIterable<T>) => AsyncIterable<A>} */
const exclusiveScan = merge => init => c => ({
    async *[Symbol.asyncIterator]() {
        let result = init
        for await (const i of c) {
            result = await merge(result)(i)
            yield result
        }
    }
})

/** @type {<T, R>(es: seq.ExlusiveScan<T, R>) => (c: AnyIterable<T>) => AsyncIterable<R>} */
const applyExclusiveScan = es => c => ({
    async *[Symbol.asyncIterator]() {
        let ies = es
        for await (const i of c) {
            const result = ies(i)
            ies = result[1]
            yield result[0]
        }
    }
})

/** @type {<A, T>(merge: Merge<A, T>) => (init: A) => (c: AnyIterable<T>) => AsyncIterable<A>} */
const inclusiveScan = merge => init => c => concat([init])(exclusiveScan(merge)(init)(c))

/** @type {<I, S, R>(op: seq.Operation<I, S, R>) => (_: AnyIterable<I>) => Promise<R>} */
const apply = ({ merge, init, result }) => async c => result(await reduce(merge)(init)(c))

const sum = apply(seq.sum)

const join = pipe(seq.join)(apply)

const size = apply(seq.size)

module.exports = {
    /** @readonly */
    apply,
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
    exclusiveScan,
    /** @readonly */
    inclusiveScan,
}