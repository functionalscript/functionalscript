const lib = require('../')

/** @type {<T, R>(_: lib.Reducer<T, R>) => (_: Iterable<T>) => R} */
const reduce = ({merge, value}) => c => {
    let result = value
    for (let i of c) {
        result = merge(result)(i)
    }
    return result
}

module.exports = {
    reduce,
    /** @type {(_: string) => (_: Iterable<string>) => string} */
    join: s => reduce(lib.join(s)),
    /** @type {<T, R>(_: (_: T) => R) => (_: Iterable<T>) => Iterable<R>} */
    map: f => c => ({
        *[Symbol.iterator]() {
            for (let i of c) {
                yield f(i)
            }
        }
    }),        
}
