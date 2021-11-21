const { pipe } = require('../lib')
const lib = require('../lib')
const mr = require('../map-reduce')

/** @type {<T, R>(merge: (_: R) => (_: T) => R) => (init: R) => (_: Iterable<T>) => R} */
const reduce = merge => init => c => {
    let result = init
    for (const i of c) {
        result = merge(result)(i)
    }
    return result
}

/** @type {<I, S, R>(op: mr.Operation<I, S, R>) => (_: Iterable<I>) => R} */
const apply = op => pipe(reduce(op.reduce)(op.init))(op.result)

module.exports = {
    /** @readonly */
    apply,

    /** @readonly */
    reduce,

    /** @readonly */
    join: pipe(mr.join)(apply),

    /** @readonly */
    sum: apply(mr.sum),

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
