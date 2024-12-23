import * as _ from './module.f.ts'

export default () => {
    const optionSq = _.map((v: number) => v * v)
    const sq3 = optionSq(3)
    if (sq3 !== 9) { throw sq3 }
    const sqNull = optionSq(null)
    if (sqNull !== null) { throw sqNull }
}
