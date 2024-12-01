import list, * as List from '../list/module.f.mjs'
const { reduce: listReduce, repeat: listRepeat } = list
import f from '../function/module.f.mjs'
const { compose } = f
import compare, * as Compare from '../function/compare/module.f.mjs'
const { unsafeCmp } = compare
import op, * as Op from '../function/operator/module.f.mjs'
const { join: joinOp, concat: concatOp } = op

/** @type {(o: Op.Reduce<string>) => (input: List.List<string>) => string} */
const reduce = o => listReduce(o)('')

const join = compose(joinOp)(reduce)

const concat = reduce(concatOp)

/** @type {(n: string) => (v: number) => string} */
const repeat = v => compose(listRepeat(v))(concat)

/** @type {(a: string) => (b: string) => Compare.Sign} */
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
