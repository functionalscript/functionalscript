const _ = require('./module.f.cjs')

module.exports = () => {
    const optionSq = _.map(v => v * v)
    const sq3 = optionSq(3)
    if (sq3 !== 9) { throw sq3 }
    const sqUndefined = optionSq(null)
    if (sqUndefined !== null) { throw sqUndefined }
}
