import * as list from '../list/module.f.ts'
const { reduce: listReduce, repeat: listRepeat } = list
import * as f from '../function/module.f.mjs'
const { compose } = f
import * as compare from '../function/compare/module.f.ts'
const { unsafeCmp } = compare
import * as op from '../function/operator/module.f.mjs'
const { join: joinOp, concat: concatOp } = op

const reduce
    : (o: op.Reduce<string>) => (input: list.List<string>) => string
    = o => listReduce(o)('')

export const join = compose(joinOp)(reduce)

export const concat = reduce(concatOp)

export const repeat
    : (n: string) => (v: number) => string
    = v => compose(listRepeat(v))(concat)

export const cmp
    : (a: string) => (b: string) => compare.Sign
    = unsafeCmp
