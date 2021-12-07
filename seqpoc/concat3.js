const _ = require('.')

let i = 0

/**
 * https://en.wikipedia.org/wiki/Tetrahedral_number
 * 
 * 1,4,10,20, 35,56,84,120
 * 
 * Time complexity: O(N^3)
 *  
 * @type {<T>(b: _.Sequence<T>) => (a: _.Sequence<T>) => _.Sequence<T>} 
 */
const rconcat = b => {
    /** @typedef {typeof b extends _.Sequence<infer T> ? T : never} T */
    /** @type {(x: _.Sequence<T>) => _.Sequence<T>} */
    const m = a => {
        i = i + 1
        if (i % 1_000_000 === 0) { console.log(i) }
        if (typeof a === 'function') { return () => m(a()) }
        if (a === undefined) { return b }
        const [first, tail] = a
        return [first, () => m(tail)]
    }
    return m
}

/**
 * Time complexity O(2^N)
 * 
 * @type {<T>(a: _.Sequence<T>) => (b: _.Sequence<T>) => _.Thunk<T>} 
 */
const concat = a => b => () => rconcat(b)(a)

module.exports = {
    /** @readonly */
    concat
}
