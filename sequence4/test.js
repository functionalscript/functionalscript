const _ = require('.')
const json = require('../json')
const { sort } = require('../object')

{
    const result = json.stringify(sort)(_.toArray(_.countdown(10)))
    if (result !== '[9,8,7,6,5,4,3,2,1,0]') { throw result }
}

// stress test
{
    // 200_000_000 is too much
    const n = 100_000_000
    const result = _.toArray(_.countdown(n))
    if (result.length !== n) { throw result.length }
}