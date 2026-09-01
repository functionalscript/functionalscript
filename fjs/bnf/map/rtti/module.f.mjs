/**
 * Checks RTTI declarations for a set of rule transformations.
 *
 * @module
 *
 * @import { Rule } from '../../types.ts'
 * @import { Type } from '../../../rtti/types.ts'
 * @import { RuleInfo, Base, Mapped, Terminal, Sequence, Variant, Repeat } from './types.ts'
 */

import { assert } from '../../../asserts/module.f.mjs'
import { repeatItem as normalizedRepeatItem } from '../../data/module.f.mjs'
import { number, string, unknown, array, or } from '../../../rtti/module.f.mjs'
import { equal, toData } from '../../../rtti/data/module.f.mjs'
import { stringToCodePointList } from '../../../text/utf16/module.f.mjs'
import { toArray } from '../../../types/list/module.f.mjs'
import { definedEntries, definedValues } from '../../../types/object/module.f.mjs'

const codePointMeta = /** @type {const} */ ([number, unknown])

/** @type {Type} */
const ast = () => ['const', {
    tag: or(string, true, undefined),
    sequence: array(or(ast, codePointMeta)),
}]

/** @type {(a: Type, b: Type) => boolean} */
const typeEqual = (a, b) => equal(toData(a))(toData(b))

/** @type {(a: readonly Rule[], rule: Rule) => boolean} */
const hasRule = (a, rule) => a.some(v => v === rule)

/** @type {(ri: readonly RuleInfo[], rule: Rule) => Mapped | null} */
const findInfo = (ri, rule) => ri.find(([r]) => r === rule)?.[1] ?? null

/** @type {(rule: Rule) => Rule | null} */
const repeatItem = normalizedRepeatItem

/** @type {Terminal} */
export const terminal = info => /** @type {any} */ (info)

/** @type {Sequence} */
export const sequence = info => /** @type {any} */ (info)

/** @type {Variant} */
export const variant = info => /** @type {any} */ (info)

/** @type {Repeat} */
export const repeat = info => /** @type {any} */ (info)

/** @type {(rule: Rule) => readonly Rule[]} */
const children = rule => {
    const repeated = repeatItem(rule)
    if (repeated !== null) { return [repeated] }
    const data = typeof rule === 'function' ? rule() : rule
    if (typeof data === 'number' || typeof data === 'string') { return [] }
    return data instanceof Array ? data : definedValues(data)
}

/** @type {(rule: Rule) => Base['tag']} */
const tagOf = rule => {
    if (repeatItem(rule) !== null) { return 'repeat' }
    const data = typeof rule === 'function' ? rule() : rule
    if (typeof data === 'number') { return 'terminal' }
    if (typeof data === 'string' || data instanceof Array) { return 'sequence' }
    return 'variant'
}

/** @type {(ri: readonly RuleInfo[]) => (rule: Rule) => Type} */
const outputOf = ri => rule => findInfo(ri, rule)?.ro ?? ast

/** @type {(ri: readonly RuleInfo[]) => (rule: Rule) => Type} */
const inputOf = ri => rule => {
    const output = outputOf(ri)
    const repeated = repeatItem(rule)
    if (repeated !== null) { return output(repeated) }
    const data = typeof rule === 'function' ? rule() : rule
    if (typeof data === 'number') { return number }
    if (typeof data === 'string') {
        return toArray(stringToCodePointList(data)).map(() => ast)
    }
    if (data instanceof Array) { return data.map(output) }
    return Object.fromEntries(definedEntries(data).map(([k, v]) => [k, output(v)]))
}

/** @type {(seen: readonly Rule[], rule: Rule) => readonly Rule[]} */
const touch = (seen, rule) => {
    if (hasRule(seen, rule)) { return seen }
    return children(rule).reduce(touch, [...seen, rule])
}

/** @type {(ri: readonly RuleInfo[]) => ReadonlyMap<Rule, Base>} */
export const checkMap = ri => {
    for (let i = 0; i < ri.length; ++i) {
        const [rule, info] = ri[i]
        assert(!ri.slice(0, i).some(([r]) => r === rule), 'duplicate rule mapping')
        assert(info.tag === tagOf(rule), 'wrong rule mapping kind')
    }
    const touched = ri.reduce(
        (seen, [rule]) => touch(seen, rule),
        /** @type {readonly Rule[]} */ ([]),
    )
    for (const rule of touched) {
        if (tagOf(rule) === 'variant') {
            const mapped = findInfo(ri, rule) !== null
            assert(
                children(rule).every(child => (findInfo(ri, child) !== null) === mapped),
                'mixed mapped and unmapped variant boundary',
            )
        }
    }
    const input = inputOf(ri)
    return new Map(/** @type {readonly (readonly [Rule, Base])[]} */ (touched.map(rule => {
        const declared = findInfo(ri, rule)
        const inferred = input(rule)
        if (declared !== null) {
            assert(typeEqual(declared.ri, inferred), 'wrong rule mapping input type')
            return /** @type {const} */ ([rule, declared])
        }
        /** @type {Base} */
        const identity = { tag: tagOf(rule), ri: inferred, ro: ast, map: null }
        return /** @type {const} */ ([rule, identity])
    })))
}
