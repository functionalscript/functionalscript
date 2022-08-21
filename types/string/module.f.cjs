const list = require('../list/module.f.cjs')
const { reduce: listFold, repeat: listRepeat } = list
const { compose } = require('../function/module.f.cjs')
const compare = require('../function/compare/module.f.cjs')
const { unsafeCmp } = compare
const op = require('../function/operator/module.f.cjs')
const { join: joinOp, concat: concatOp } = op

/** @type {(o: op.Reduce<string>) => (input: list.List<string>) => string} */
const fold = o => listFold(o)('')

const join = compose(joinOp)(fold)

const concat = fold(concatOp)

/** @type {(n: string) => (v: number) => string} */
const repeat = v => compose(listRepeat(v))(concat)

/** @type {(a: string) => (b: string) => compare.Sign} */
const cmp = unsafeCmp

module.exports = {
    /** @readonly */
    join,
    /** @readonly */
    concat,
    /** @readonly */
    repeat,
    /** @readonly */
    cmp,
}
