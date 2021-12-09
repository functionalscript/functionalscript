const _ = require('.')
const json = require('../../json')
const { identity } = require('../function')

const stringify = json.stringify(identity)

{
    const x = stringify(_.toArray(_.take(10)(_.cycle([1, 2, 3]))))
    if (x !== '[1,2,3,1,2,3,1,2,3,1]') { throw x }
}