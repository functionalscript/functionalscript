import * as _ from './module.f.mjs'

export default () => {
    const optionSq = _.map(v => v * v)
    const sq3 = optionSq(3)
    if (sq3 !== 9) { throw sq3 }
    const sqNull = optionSq(null)
    if (sqNull !== null) { throw sqNull }
}
