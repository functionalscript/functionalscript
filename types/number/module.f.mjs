// @ts-self-types="./module.f.d.mts"
import * as list from '../list/module.f.mjs'
const { reduce } = list
import * as operator from '../function/operator/module.f.mjs'
const { addition, min: minOp, max: maxOp } = operator
import * as compare from '../function/compare/module.f.mjs'
const { unsafeCmp } = compare

export const sum = reduce(addition)(0)

export const min = reduce(minOp)(null)

export const max = reduce(maxOp)(null)

/** @type {(a: number) => (b: number) => compare.Sign} */
export const cmp = unsafeCmp
