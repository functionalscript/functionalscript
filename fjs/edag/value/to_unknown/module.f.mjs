/**
 * Materialize EDAG values as ordinary runtime values. Tagged
 * undefined becomes undefined, and represented arrays and objects become
 * ordinary arrays and objects. Shared container nodes remain shared; distinct
 * nodes remain distinct. Each conversion builds fresh runtime containers.
 *
 * `toData` decodes function-free graphs synchronously and refuses functions,
 * including those nested in data. `toUnknown` requests target compilation for
 * callable graphs. The generated module constructs fresh ordinary values per
 * request; ordinary function calls execute generated code with reflection erased.
 * Host loading failures use the effect error channel, separate from VM failures.
 *
 * Values satisfy the constructor/admission contract. FJS construction is
 * acyclic, so completed containers can be reused without a cycle check.
 * No reverse conversion or recovery of EDAG reflection is implied.
 *
 * @module
 * @import { EdagValue } from '../types.ts'
 * @import { Result } from '../../../types/result/types.ts'
 * @import { Unknown } from '../../../media/datajs/types.ts'
 * @import { Commands, CommandSet, Effect, Func, IoChannel } from '../../../effects/types.ts'
 * @import { CompileValue } from './types.ts'
 * @import { _Copies, _Converted } from './private.ts'
 */

import { assoc, isArray } from '../../../types/array/module.f.mjs'
import { error, mapOk, ok } from '../../../types/result/module.f.mjs'
import { do_, pureOk } from '../../../effects/module.f.mjs'
import { factoryStringify } from '../../../compiler/serializer/value/module.f.mjs'
import { untagUndefined } from '../semantics/module.f.mjs'

/** Decode data while retaining all completed container identities. @type {(copies: _Copies, input: EdagValue) => _Converted} */
const convert = (copies, input) => {
    const value = untagUndefined(input)
    if (!isArray(value)) { return ok([copies, value]) }
    if (value[0] === '=>') { return error('callable materialization requires a target compile/load boundary') }
    const known = assoc(value)(copies)
    if (known !== null) { return ok([copies, known]) }
    const children = value[0] === '[]' ? value[1] : value[1].map(([, , child]) => child)
    /** @type {readonly Unknown[]} */
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

/** Convert runtime data, refusing values that require callable materialization. @type {(value: EdagValue) => Result<Unknown, string>} */
export const toData = value => mapOk(
    /** @type {(converted: readonly [_Copies, Unknown]) => Unknown} */
    (([, runtime]) => runtime),
)(convert([], value))

/** @type {Func<CompileValue>} */
const compileValue = do_('compileValue')

/** The complete operation set of callable runtime conversion. @type {CommandSet<CompileValue>} */
const compileCommandSet = { compileValue: null }

/** Commands a partial runtime may explicitly decline. @type {Commands<CompileValue>} */
export const compileCommands = /** @type {Commands<CompileValue>} */ (Object.keys(compileCommandSet))

/** Convert data directly or request target compilation of the complete callable graph. @type {(value: EdagValue) => Effect<CompileValue, unknown, IoChannel>} */
export const toUnknown = value => {
    const [kind, data] = toData(value)
    return kind === 'ok' ? pureOk(data) : compileValue(factoryStringify(value))
}
