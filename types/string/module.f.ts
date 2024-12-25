import { type List, reduce as listReduce, repeat as listRepeat } from '../list/module.f.ts'
import { compose } from '../function/module.f.ts'
import * as compare from '../function/compare/module.f.ts'
const { unsafeCmp } = compare
import { join as joinOp, concat as concatOp, type Reduce } from '../function/operator/module.f.ts'

const reduce
    : (o: Reduce<string>) => (input: List<string>) => string
    = o => listReduce(o)('')

export const join
    : (_: string) => (input: List<string>) => string
    = compose(joinOp)(reduce)

export const concat
    : (input: List<string>) => string
    = reduce(concatOp)

export const repeat
    : (n: string) => (v: number) => string
    = v => compose(listRepeat(v))(concat)

export const cmp
    : (a: string) => (b: string) => compare.Sign
    = unsafeCmp
