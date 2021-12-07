const _ = require('.')

/**
 * Cause stack overflow
 *  
 * @type {<T>(a: _.Sequence<T>) => (b: _.Sequence<T>) => _.Thunk<T>} 
 */
const concat = a => b => () => {
    const r = _.next(a)
    if (r === undefined) { return b }
    const [first, tail] = r
    return [first, concat(tail)(b)]
}

module.exports = {
    /** @readonly */
    concat
}
