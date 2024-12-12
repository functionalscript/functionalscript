// @ts-self-types="./module.f.d.mts"
import * as list from '../list/module.f.mjs'
const { reduce: listReduce, repeat: listRepeat } = list
import * as f from '../function/module.f.mjs'
const { compose } = f
import * as compare from '../function/compare/module.f.mjs'
const { unsafeCmp } = compare
import * as op from '../function/operator/module.f.mjs'
const { join: joinOp, concat: concatOp } = op

/** @type {(o: op.Reduce<string>) => (input: list.List<string>) => string} */
const reduce = o => listReduce(o)('')

const join = compose(joinOp)(reduce)

const concat = reduce(concatOp)

/** @type {(n: string) => (v: number) => string} */
const repeat = v => compose(listRepeat(v))(concat)

/** @type {(a: string) => (b: string) => compare.Sign} */
const cmp = unsafeCmp

export default {
    /** @readonly */
    join,
    /** @readonly */
    concat,
    /** @readonly */
    repeat,
    /** @readonly */
    cmp,
}
