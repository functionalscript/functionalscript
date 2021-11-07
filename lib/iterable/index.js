const lib = require('../')

/** @type {<T, R>(_: lib.Reducer<T, R>) => (_: Iterable<T>) => R} */
const reduce = ({merge, init}) => c => {
    let result = init
    for (let i of c) {
        result = merge(result)(i)
    }
    return result
}

module.exports = {
    reduce,
    join: lib.pipe(lib.join)(reduce),
    /** @type {<T, R>(_: (_: T) => R) => (_: Iterable<T>) => Iterable<R>} */
    map: f => c => ({
        *[Symbol.iterator]() {
            for (let i of c) {
                yield f(i)
            }
        }
    }),        
}
