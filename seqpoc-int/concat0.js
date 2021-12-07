const _ = require('.')

/**
 * Cause stack overflow
 *  
 * @type {<T>(a: _.Sequence<T>) => (b: _.Sequence<T>) => _.Sequence<T>} 
 */
const concat = a => b => {
    if (typeof a === 'function') { return tail => concat(a(b))(tail) }
    if (a === undefined) { return b }
    const [first, tail] = a
    return [first, concat(tail)(b)]
}

module.exports = {
    /** @readonly */
    concat
}
