const { sum, min, max } = require('./module.f.cjs')

{
    const result = sum([2, 3, 4, 5])
    if (result !== 14) { throw result }
}

{
    const result = min([])
    if (result !== undefined) { throw result }
}

{
    const result = min([1, 2, 12, -4, 8])
    if (result !== -4) { throw result }
}

{
    const result = max([1, 2, 12, -4, 8])
    if (result !== 12) { throw result }
}

module.exports = {}