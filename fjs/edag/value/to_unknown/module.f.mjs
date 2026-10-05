/**
 * Materialize function-free EDAG values as ordinary runtime data. Tagged
 * undefined becomes undefined, and represented arrays and objects become
 * ordinary arrays and objects. Shared container nodes remain shared; distinct
 * nodes remain distinct. Each conversion builds fresh runtime containers.
 *
 * A function requires the target's compile/load boundary and returns an output
 * diagnostic here, including when nested in data. Its captures and body are
 * not converted or executed. This diagnostic is separate from VM language
 * failures. Callable materialization remains part of the EDAG Value migration.
 *
 * Values satisfy the constructor/admission contract. FJS construction is
 * acyclic, so completed containers can be reused without a cycle check.
 * No reverse conversion or recovery of EDAG reflection is implied.
 *
 * @module
 * @import { EdagValue } from '../types.ts'
 * @import { Result } from '../../../types/result/types.ts'
 * @import { _Copies, _Converted } from './private.ts'
 */

import { assoc, isArray } from '../../../types/array/module.f.mjs'
import { error, mapOk, ok } from '../../../types/result/module.f.mjs'
import { untagUndefined } from '../semantics/module.f.mjs'

/** Decode data while retaining all completed container identities. @type {(copies: _Copies, input: EdagValue) => _Converted} */
const convert = (copies, input) => {
    const value = untagUndefined(input)
    if (!isArray(value)) { return ok([copies, value]) }
    if (value[0] === '=>') { return error('callable materialization requires a target compile/load boundary') }
    const known = assoc(value)(copies)
    if (known !== null) { return ok([copies, known]) }
    const children = value[0] === '[]' ? value[1] : value[1].map(([, , child]) => child)
    /** @type {readonly unknown[]} */
    let items = []
    for (const child of children) {
        const result = convert(copies, child)
        const [kind, converted] = result
        if (kind === 'error') { return result }
        const [next, item] = converted
        copies = next
        items = [...items, item]
    }
    const output = value[0] === '[]'
        ? items
        : Object.fromEntries(value[1].map(([, key], i) => [key, items[i]]))
    return ok([[...copies, [value, output]], output])
}

/** Convert runtime data, refusing values that require callable materialization. @type {(value: EdagValue) => Result<unknown, string>} */
export const toUnknown = value => mapOk(
    /** @type {(converted: readonly [_Copies, unknown]) => unknown} */
    (([, runtime]) => runtime),
)(convert([], value))
