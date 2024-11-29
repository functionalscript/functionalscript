const _ = require('./module.f.mjs').default

module.exports = () => {
    const optionSq = _.map(v => v * v)
    const sq3 = optionSq(3)
    if (sq3 !== 9) { throw sq3 }
    const sqNull = optionSq(null)
    if (sqNull !== null) { throw sqNull }
}
