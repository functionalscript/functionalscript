const _ = require('.')
const json = require('../json')
const { sort } = require('../object')
const { compose } = require('../function')

/** @type {(sequence: _.Sequence<json.Json>) => string} */
const stringify = sequence => json.stringify(sort)(_.toArray(sequence))

{
    const result = stringify(_.countdown(10))
    if (result !== '[9,8,7,6,5,4,3,2,1,0]') { throw result }
}

{
    const result = stringify(_.concat([1, 2, 3], [4, 5], [6], undefined, [7, 8, 9]))
    if (result !== '[1,2,3,4,5,6,7,8,9]') { throw result }
}

// stress tests

/*
{
    // 200_000_000 is too much
    const n = 100_000_000
    const result = _.toArray(_.countdown(n))
    if (result.length !== n) { throw result.length }
    const first = _.first(result)
    if (first !== n - 1) { throw first }
}
*/

{
    /** @type {_.Sequence<number>} */
    let sequence = undefined
    for (let i = 0; i < 1_000_000; ++i) {
        sequence = _.concat(sequence, [i])
    }
    const a = _.next(sequence)
}

/**
 * @template I, O
 * @typedef {{
 *  data: I
 *  func: (_: I) => O
 * }}
 */