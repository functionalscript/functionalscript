import * as list from '../list/module.f.ts'
const { reduce } = list
import * as operator from '../function/operator/module.f.ts'
const { addition, min: minOp, max: maxOp } = operator
import * as compare from '../function/compare/module.f.ts'
const { unsafeCmp } = compare

export const sum = reduce(addition)(0)

export const min = reduce(minOp)(null)

export const max = reduce(maxOp)(null)

export const cmp
    : (a: number) => (b: number) => compare.Sign
    = unsafeCmp
