const _ = require('.')

let i = 0

/**
 * Time complexity: O(N^2)
 *  
 * @type {<T>(b: _.Sequence<T>) => (a: _.Sequence<T>) => _.Sequence<T>} 
 */
const rconcat = b => {
    /** @typedef {typeof b extends _.Sequence<infer T> ? T : never} T */
    /** @type {(x: _.Sequence<T>) => _.Sequence<T>} */
    const m = a => {
        i = i + 1
        console.log(i)
        if (typeof a === 'function') { return () => m(a()) }
        if (a === undefined) { return b }
        const [first, tail] = a
        // m(tail) is not lazy!
        return [first, m(tail)]
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
