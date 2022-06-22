const _ = require('./f.js')

{
    const result = _.numberCmp(4)(5)
    if (result !== -1) { throw result }
}

{
    const result = _.stringCmp('3')('4')
    if (result !== -1) { throw result }
}

module.exports = {}
