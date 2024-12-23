import { reduce } from '../list/module.f.ts'
import { addition, min as minOp, max as maxOp } from '../function/operator/module.f.ts'
import * as compare from '../function/compare/module.f.ts'
const { unsafeCmp } = compare

export const sum = reduce(addition)(0)

export const min = reduce(minOp)(null)

export const max = reduce(maxOp)(null)

export const cmp
    : (a: number) => (b: number) => compare.Sign
    = unsafeCmp
