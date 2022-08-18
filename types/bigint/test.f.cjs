const { sum } = require('./module.f.cjs')

{
    const result = sum([2n, 3n, 4n, 5n])
    if (result !== 14n) { throw result }
}

module.exports = {}