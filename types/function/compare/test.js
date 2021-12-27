const _ = require('.')

{
    const result = _.cmp(4)(5)
    if (result !== -1) { throw result }
}

{
    const result = _.cmp(/** @type {string|number} */(4))('4')
    if (result !== 0) { throw result }
}

module.exports = {}
