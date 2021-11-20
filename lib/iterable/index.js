const lib = require('../')

/** @type {<T, R>(_: lib.Reduce<T, R>) => (_: Iterable<T>) => R} */
const reduce = ({ merge, init }) => c => {
    let result = init
    for (const i of c) {
        result = merge(result)(i)
    }
    return result
}

module.exports = {
    /** @readonly */
    reduce,

    /** @readonly */
    join: lib.pipe(lib.join)(reduce),

    /** @readonly */
    sum: reduce(lib.sum),

    /** 
     * @readonly
     * @type {<T, R>(f: (value: T) => R) => (c: Iterable<T>) => Iterable<R>} 
     */
    map: f => c => ({
        *[Symbol.iterator]() {
            for (const i of c) {
                yield f(i)
            }
        }
    }),

    /**
     * @readonly
     * @type {<T, R>(f: (value: T) => Promise<R>) => (c: AsyncIterable<T>) => AsyncIterable<R>}
     */
    asyncMap: f => c => ({
        async *[Symbol.asyncIterator]() {
            for await (const i of c) {
                yield* [f(i)]
            }
        }
    }),

    /** 
     * @readonly
     * @type {<T>(_: (_: T) => boolean) => (_: Iterable<T>) => T|undefined} 
     */
    find: f => c => {
        for (const i of c) {
            if (f(i)) {
                return i
            }
        }
        return undefined
    }
}
