/**
 * Construct evaluated EDAG functions from deferred captures and body code.
 * Captures evaluate left to right. The first failure returns unchanged and
 * stops later captures; successful slots retain their value identities.
 *
 * Each construction creates a fresh function and copies its body graph,
 * preserving sharing within the body and distinct equal-looking nodes.
 * Nested function templates, including their slot expressions, stay code
 * and receive fresh nodes too. Evaluated captures stay outside this copy.
 * The body is never executed during construction.
 *
 * Length, body bindings and scope already satisfy the compiler/admission
 * contract, including the existing parameter limit. This constructor does
 * not revalidate them. Invocation belongs to the executor.
 *
 * @module
 * @import { Exp } from '../../types.ts'
 * @import { EdagValue, Values, Function as ValueFunction } from '../types.ts'
 * @import { ValueThunk } from '../control/types.ts'
 * @import { Result } from '../../../types/result/types.ts'
 * @import { _Part, _Copies } from './private.ts'
 */

import { assoc, isArray } from '../../../types/array/module.f.mjs'
import { ok } from '../../../types/result/module.f.mjs'

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

/** Build a fresh function with evaluated captures and its own body scope. @type {(length: number, captures: readonly ValueThunk[], template: Exp) => Result<ValueFunction, EdagValue>} */
export const func = (length, captures, template) => {
    /** @type {Values} */
    let values = []
    for (const capture of captures) {
        const result = capture()
        const [kind, value] = result
        if (kind === 'error') { return result }
        values = [...values, value]
    }
    const [, body] = copy([], template)
    // The copier retains every leaf and tuple position, so this is still an
    // Exp. TypeScript cannot express that correspondence through _Part.
    return ok(['=>', length, values, /** @type {Exp} */ (body)])
}
