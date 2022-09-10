const _ = require('./module.f.cjs')

{
    if (_.has(0)(_.empty)) { throw _.empty }
    if (_.has(1)(_.empty)) { throw _.empty }
    if (_.has(33)(_.empty)) { throw _.empty }
}

{
    const s = _.set(0)(_.empty)
    if (s !== 1n) { throw s }
    if (!_.has(0)(s)) { throw s }
    if (_.has(1)(s)) { throw s }
    if (_.has(33)(s)) { throw s }
}

{
    const s = _.set(33)(_.empty)
    if (s !== 8589934592n) { throw s }
    if (_.has(0)(s)) { throw s }
    if (_.has(1)(s)) { throw s }
    if (!_.has(33)(s)) { throw s }
}

{
    const a = _.set(0)(_.empty)
    const result = _.unset(0)(a)
    if (result !== 0n) { throw result }
}

{
    const a = _.set(255)(_.empty)
    const result = _.unset(255)(a)
    if (result !== 0n) { throw result }
}

{
    const result = _.setRange([2, 5])(_.empty)
    if (result !== 60n) { throw result }
}

module.exports = {

}
