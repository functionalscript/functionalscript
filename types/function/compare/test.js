const _ = require('.')

{
    const result = _.cmp(/** @type {number} */(4))(5)
    if (result !== -1) { throw result }
}

module.exports = {}