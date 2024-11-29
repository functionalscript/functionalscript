const list = require('../list/module.f.cjs')
const { reduce: listReduce, repeat: listRepeat } = list
const { compose } = require('../function/module.f.cjs')
const compare = require('../function/compare/module.f.mjs')
const { unsafeCmp } = compare.default
const op = require('../function/operator/module.f.mjs')
const { join: joinOp, concat: concatOp } = op.default

/** @type {(o: op.Reduce<string>) => (input: list.List<string>) => string} */
const reduce = o => listReduce(o)('')

const join = compose(joinOp)(reduce)

const concat = reduce(concatOp)

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
