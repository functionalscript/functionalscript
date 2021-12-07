const _ = require('.')

let x = 0

/**
 * Time complexity O(2^N)
 * 
 * @type {<T>(a: _.Sequence<T>) => (b: _.Sequence<T>) => _.Thunk<T>} 
 */
const concat = a => b => () => {
    if (typeof a === 'function') { 
        x = x + 1
        console.log(x)
        return () => concat(a())(b) 
    }
    if (a === undefined) { return b }
    const [first, tail] = a
    return [first, concat(tail)(b)]
}

module.exports = {
    /** @readonly */
    concat
}
