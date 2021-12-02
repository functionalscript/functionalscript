const { compose } = require('../function')

/** @type {<T>(a: Iterable<T>) => (b: Iterable<T>) => Iterable<T>} */
const concat = a => b => ({
    *[Symbol.iterator]() {
        yield* a
        yield* b
    }
})

/** @type {<T>(a: Iterable<Iterable<T>>) => Iterable<T>} */
const flat = input => ({
    *[Symbol.iterator]() {
        for (const i of input) {
            yield *i
        }
    }
})

/** @type {<I, O>(f: (value: I) => O) => (input: Iterable<I>) => Iterable<O>} */
const map = f => input => ({
    *[Symbol.iterator]() {
        for (const i of input) {
            yield f(i)
        }
    }
})

/** @type {<I, O>(f: (value: I) => Iterable<O>) => (input: Iterable<I>) => Iterable<O>} */
const flatMap = f => compose(map(f))(flat)

// /** @type {<T, R>(s: seq.Scan<T, R>) => (c: Iterable<T>) => Iterable<R>} */
// const scan = s => c => ({
//     *[Symbol.iterator]() {
//         let next = s
//         for (const i of c) {
//             const result = next(i)
//             next = result[1]
//             yield result[0]
//         }
//     }
// })

// /** @type {<T, R>(s: seq.ExclusiveScan<T, R>) => (c: Iterable<T>) => Iterable<R>} */
// const exclusiveScan = ([first, s]) => c => concat([first])(scan(s)(c))

// /** @type {<T, R>(s: seq.ExclusiveScan<T, R>) => (c: Iterable<T>) => R} */
// const reduce = ([first, s]) => c => {
//     let next = first
//     for (const i of scan(s)(c)) {
//         next = i
//     }
//     return next
// }

// const entries = scan(seq.entries)

// const sum = reduce(seq.sum)

// const length = reduce(seq.length)

// const join = compose(seq.join)(reduce)

// /** @type {<T>(f: (value: T) => boolean) => (c: Iterable<T>) => Iterable<T>} */
// const filter = seq.filter(flatMap)

// /** @type {<T>(f: (value: T) => boolean) => (c: Iterable<T>) => Iterable<T>} */
// const takeWhile = f => c => ({
//     *[Symbol.iterator]() {
//         for (const i of c) {
//             if (!f(i)) { return }
//             yield i
//         }
//     }
// })

// /** @type {<T>(_: (_: T) => boolean) => (_: Iterable<T>) => T|undefined} */
// const find = f => c => {
//     for (const i of c) {
//         if (f(i)) {
//             return i
//         }
//     }
//     return undefined
// }

module.exports = {
    /** @readonly */
    concat,    
    /** @readonly */
    flat,
    /** @readonly */
    map,
    /** @readonly */
    flatMap,
    // /** @readonly */
    // reduce,
    // /** @readonly */
    // join,
    // /** @readonly */
    // sum,
    // /** @readonly */
    // length,
    // /** @readonly */
    // entries,
    // /** @readonly */
    // scan,
    // /** @readonly */
    // exclusiveScan,
    // /** @readonly */
    // filter,
    // /** @readonly */
    // takeWhile,
    // /** @readonly */
    // find,
}
