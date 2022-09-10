const _ = require('./module.f.cjs')

{
    if (_.has(0)(_.empty)) { throw _.empty }
    if (_.has(1)(_.empty)) { throw _.empty }
    if (_.has(15)(_.empty)) { throw _.empty }
}

{
    const s = _.set(0)(_.empty)
    if (s !== 1) { throw s }
    if (!_.has(0)(s)) { throw s }
    if (_.has(1)(s)) { throw s }
    if (_.has(15)(s)) { throw s }
}

{
    const s = _.set(15)(_.empty)
    if (s !== 32768) { throw s }
    if (_.has(0)(s)) { throw s }
    if (_.has(1)(s)) { throw s }
    if (!_.has(15)(s)) { throw s }
}

{
    const a = _.set(0)(_.empty)
    const result = _.unset(0)(a)
    if (result !== 0) { throw result }
}

{
    const a = _.set(15)(_.empty)
    const result = _.unset(15)(a)
    if (result !== 0) { throw result }
}

{
    const result = _.setRange([2, 5])(_.empty)
    if (result !== 60) { throw result }
}

module.exports = {

}
