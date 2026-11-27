/**
 * Construct evaluated EDAG functions from deferred captures and body code,
 * and give the functions of a value bodies of their own.
 * Captures evaluate left to right. The first failure returns unchanged and
 * stops later captures; successful slots retain their value identities.
 *
 * Each construction creates a fresh function over the body code it was
 * given: two functions made from one arrow share that code, and a function
 * shares its body with the body that made it. An executor reads a body and
 * keeps nothing under its nodes beyond one invocation, so the sharing costs
 * it nothing, and a function made at every step of a loop is made in a
 * number of steps its captures set, not its body.
 * The body is never executed during construction.
 *
 * What finds sharing by node identity cannot read such a value: the
 * analysis takes one node under two functions for a node shared across a
 * function boundary and refuses it. {@link ownBodies} answers the same
 * value with every function's body a copy of its own, preserving sharing
 * within a body and between values, and whatever analyses or writes an
 * evaluated value takes it through that first.
 *
 * Length, body bindings and scope already satisfy the compiler/admission
 * contract, including the existing parameter limit. This constructor does
 * not revalidate them. Invocation belongs to the executor.
 *
 * @module
 * @import { Exp } from '../../types.ts'
 * @import { EdagValue, Values, Closure, CodeFunction, Group, GroupFunction } from '../types.ts'
 * @import { ValueThunk } from '../control/types.ts'
 * @import { Result } from '../../../types/result/types.ts'
 * @import { _Part, _Copies, _Own } from './private.ts'
 * @import { RefMap } from '../../../types/ref_map/types.ts'
 */

import { assoc, isArray } from '../../../types/array/module.f.js'
import { empty as none } from '../../../types/ref_map/module.f.js'
import { ok } from '../../../types/result/module.f.js'

/** Copy code arrays once by identity, retaining primitive leaves. @type {(copies: _Copies, part: _Part) => readonly [_Copies, _Part]} */
const copy = (copies, part) => {
    if (!isArray(part)) { return [copies, part] }
    const known = assoc(part)(copies)
    if (known !== null) { return [copies, known] }
    /** @type {readonly _Part[]} */
    let items = []
    for (const item of part) {
        const [next, value] = copy(copies, item)
        copies = next
        items = [...items, value]
    }
    return [[...copies, [part, items]], items]
}

/** Number of fixed parameters of a represented function. @type {(fn: CodeFunction) => number} */
export const codeLength = fn => fn[0] === '=>' ? fn[1] : fn[1][2][Number(fn[2])][0]

/** Build a fresh function with evaluated captures over its body code. @type {(length: number, captures: readonly ValueThunk[], template: Exp) => Result<Closure, EdagValue>} */
export const func = (length, captures, template) => {
    /** @type {Values} */
    let values = []
    for (const capture of captures) {
        const result = capture()
        const [kind, value] = result
        if (kind === 'error') { return result }
        values = [...values, value]
    }
    return ok(['=>', length, values, template])
}

/** {@link own} of each value in order. @type {(own: _Own) => (seen: RefMap, values: Values) => readonly [RefMap, Values]} */
const each = own => (seen, values) => {
    /** @type {Values} */
    let items = []
    for (const value of values) {
        const [next, item] = own(seen, value)
        seen = next
        items = [...items, item]
    }
    return [seen, items]
}

/**
 * Copy a group once, so every function copied out of it still names the same group.
 * @type {(seen: RefMap, group: Group, own: _Own) => readonly [RefMap, Group]}
 */
const ownGroup = (seen, group, own) => {
    const [known] = seen(group)
    if (known !== undefined) { return [seen, /** @type {Group} */ (known)] }
    const [next, slots] = each(own)(seen, group[1])
    /** @type {Group} */
    const result = ['group', slots, group[2].map(([length, body]) => [length, /** @type {Exp} */ (copy([], body)[1])])]
    return [next(group, result)[1], result]
}

/** The value with its functions' bodies their own, and the values already answered. @type {_Own} */
const own = (seen, value) => {
    if (!isArray(value)) { return [seen, value] }
    const [known] = seen(value)
    if (known !== undefined) { return [seen, /** @type {EdagValue} */ (known)] }
    switch (value[0]) {
        case '[]': {
            const [next, items] = each(own)(seen, value[1])
            /** @type {EdagValue} */
            const result = ['[]', items]
            return [next(value, result)[1], result]
        }
        case '{}': {
            const [next, items] = each(own)(seen, value[1].map(([, , item]) => item))
            /** @type {EdagValue} */
            const result = ['{}', value[1].map(([, key], i) => [':', key, items[Number(i)]])]
            return [next(value, result)[1], result]
        }
        case 'fn': {
            const [next, group] = ownGroup(seen, value[1], own)
            /** @type {GroupFunction} */
            const result = ['fn', group, value[2]]
            return [next(value, result)[1], result]
        }
        case '=>': {
            const [next, slots] = each(own)(seen, value[2])
            // The copier retains every leaf and tuple position, so this is
            // still an Exp. TypeScript cannot express that correspondence
            // through _Part.
            const [, body] = copy([], value[3])
            /** @type {EdagValue} */
            const result = ['=>', value[1], slots, /** @type {Exp} */ (body)]
            return [next(value, result)[1], result]
        }
        // `undefined`, a helper and a built-in have no items and no body
        default: { return [seen, value] }
    }
}

/**
 * The value with every function in it over a body of its own: a copy of
 * the body code, nested function templates and their slot expressions
 * included, which keeps sharing within the body and shares no node with
 * another function's. A value reached twice is answered once, so what was
 * one array, object or function is one still, and two that were equal are
 * two. The answer is a new value throughout; the one given is left as it
 * was.
 *
 * @type {(value: EdagValue) => EdagValue}
 */
export const ownBodies = value => own(none, value)[1]
