// @ts-self-types="./module.f.d.mts"
import list from '../list/module.f.mjs'
const { reduce } = list
import operator from '../function/operator/module.f.mjs'
const { addition, min: minOp, max: maxOp } = operator
import compare, * as Compare from '../function/compare/module.f.mjs'
const { unsafeCmp } = compare

const sum = reduce(addition)(0)

const min = reduce(minOp)(null)

const max = reduce(maxOp)(null)

/** @type {(a: number) => (b: number) => Compare.Sign} */
const cmp = unsafeCmp

export default {
    /** @readonly */
    sum,
    /** @readonly */
    min,
    /** @readonly */
    max,
    /** @readonly */
    cmp,
}