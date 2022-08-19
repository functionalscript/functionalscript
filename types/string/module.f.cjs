const list = require('../list/module.f.cjs')
const { fold: listFold, repeat: listRepeat } = list
const { compose: compose } = require('../function/module.f.cjs')
const op = require('../function/operator/module.f.cjs')
const { join: joinOp, concat: concatOp } = op

/** @type {(o: op.Fold<string>) => (input: list.List<string>) => string} */
const fold = o => listFold(o)('')

const join = compose(joinOp)(fold)

const concat = fold(concatOp)

/** @type {(n: string) => (v: number) => string} */
const repeat = v => compose(listRepeat(v))(concat)

module.exports = {
    /** @readonly */
    join,
    /** @readonly */
    concat,
    /** @readonly */
    repeat,
}
