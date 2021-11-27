const _ = require('.')
const json = require('../json')
const { identity } = require('../function')

/** @type {(sequence: _.Sequence<json.Json>) => string} */
const stringify = sequence => json.stringify(identity)(_.array(sequence))

{
    const result = _.next(_.empty)
    if (result !== undefined) { throw result }
}

{
    const result = stringify(_.fromArray([0, 1, 2]))
    if (result !== '[0,1,2]') { throw result }
}

{
    const result = stringify(_.countdown(10))
    if (result !== '[9,8,7,6,5,4,3,2,1,0]') { throw result }
}

// stress test
{
    const result = _.array(_.countdown(100_000_000))
    if (result.length !== 100_000_000) { throw result.length }
}
