/**
 * Emit a closed EDAG value as a JavaScript module's default export. Loading
 * the emitted module constructs ordinary values and callable functions, with
 * no EDAG reflection or function registry. Loading belongs to the caller.
 *
 * The JavaScript/memo execution profile preserves shared evaluated values
 * and captures, including primitive, repeated and unused slots. Each distinct
 * outer node is constructed once; function bodies keep their own allocations
 * and lazy memo cells per invocation. Functions accept and return ordinary
 * runtime values, including callbacks with no EDAG association.
 *
 * This is value emission, separate from the source writer's FJS round-trip
 * contract. Bodies use the complete JavaScript renderer and can contain syntax
 * the FJS parser does not accept. The host's function-text exception applies.
 *
 * Compiler/VM values already satisfy shape, closure and scope invariants.
 * Analysis provides the indexed graph and body scopes; admission is not repeated.
 *
 * @module
 * @import { Analysis, Operand } from '../../../edag/analysis/types.ts'
 * @import { EdagValue } from '../../../edag/value/types.ts'
 * @import { _ValueNode } from './private.ts'
 */

import { assertOk } from '../../../asserts/module.f.mjs'
import { analysis } from '../../../edag/analysis/module.f.mjs'
import { leafSerialize } from '../../../media/datajs/serializer/module.f.mjs'
import { concat } from '../../../types/string/module.f.mjs'
import { renderSymbolic } from '../function_text/module.f.mjs'
import { name as symbol, binding, resolve } from '../names/module.f.mjs'

/** One outer node's stable binding. @type {(i: number) => string} */
const name = i => symbol(`value${i}`)

/** A leaf or a previously constructed value. @type {(v: Operand) => string} */
const operand = v => v instanceof Array ? name(v[1]) : concat(leafSerialize(v))

/** Construct one outer node; no function-body entry reaches this writer. @type {(a: Analysis, i: number, n: _ValueNode) => string} */
const entry = (a, i, n) => {
    switch (n[0]) {
        case 'undefined': { return 'undefined' }
        case '[]': { return `[${n[1].map(operand).join(',')}]` }
        case '{}': { return `{${n[1].map(([, key, value]) => `[${operand(key)}]:${operand(value)}`).join(',')}}` }
        default: {
            const slots = n[2]
            const frame = slots.map((_, k) => symbol(`value${i}/frame${k}`))
            const text = renderSymbolic(a, i, `value${i}/function`, frame)
            return slots.length === 0 ? text
                : `((${frame.map(binding).join(',')})=>(${text}))(${slots.map(operand).join(',')})`
        }
    }
}

/** Share the declarations and root expression between module entry points. @type {(value: EdagValue) => readonly [string, string]} */
const construction = value => {
    const a = assertOk(analysis(value))
    const declarations = a.nodes.flatMap((node, i) => a.scope[i] === -1
        // Analysis's general Node type cannot express the value subset that
        // construction guarantees for entries outside function-body scopes.
        ? [`const ${binding(name(i))}=${entry(a, i, /** @type {_ValueNode} */ (node))};`]
        : [])
    const [text, root] = resolve([declarations.join(''), operand(a.root)])
    return [text, root]
}

/** Emit construction code, leaving function bodies unevaluated. @type {(value: EdagValue) => string} */
export const stringify = value => {
    const [declarations, root] = construction(value)
    return `${declarations}export default ${root};`
}

/** Emit a module whose default factory constructs a fresh value per call. @type {(value: EdagValue) => string} */
export const factoryStringify = value => {
    const [declarations, root] = construction(value)
    return `export default()=>{${declarations}return ${root};};`
}
