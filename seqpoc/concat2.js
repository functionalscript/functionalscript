const _ = require('.')

/**
 * Infinite loop
 * 
 * @type {<T>(a: _.Sequence<T>) => (b: _.Sequence<T>) => _.Thunk<T>} 
 */
const concat = a => b => () => {
    if (typeof a === 'function') { return () => concat(a())(b) }
    if (a === undefined) { return b }
    const [first, tail] = a
    return [first, concat(tail)(b)]
}

module.exports = {
    /** @readonly */
    concat
}
