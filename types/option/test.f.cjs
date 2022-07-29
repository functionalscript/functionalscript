const _ = require('./main.f.cjs')

{
    const optionSq = _.map(v => v * v)
    const sq3 = optionSq(3)
    if (sq3 !== 9) { throw sq3 }
    const sqUndefined = optionSq(undefined)
    if (sqUndefined !== undefined) { throw sqUndefined }
}

module.exports = {}