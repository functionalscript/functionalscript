/**
 * EDAG admission adapters for the shared FAST-to-Rust serializer. Graphs are
 * converted and prepared once; target spelling lives in fjs/rust/serializer.
 * The corpus's named values enter conversion as already established bindings.
 * Fragment inputs retain their explicit invocation environment.
 * Inputs are shape-checked immutable EDAG data. Invocation metadata and
 * cross-scope sharing are admitted here before common conversion.
 *
 * @module
 * @import { Analysis } from '../analysis/types.ts'
 * @import { Exp, ExpOp, Index, StepOver } from '../types.ts'
 * @import { BindingId } from '../../js/ast/types.ts'
 * @import { Block, Value } from '../../js/ast/prepare/types.ts'
 * @import { External, Options, Printed, Scope } from '../../rust/serializer/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 */

import { identityAnalysis, checked } from '../analysis/module.f.mjs'
import { fromAnalysis } from '../to_fast/module.f.mjs'
import { prepare } from '../../js/ast/prepare/module.f.mjs'
import { functionStringify } from '../../js/ast/serializer/module.f.mjs'
import { isIntrinsic, isStatic } from '../module.f.mjs'
import { operandsOf, visit } from '../sharing/module.f.mjs'
import { error, mapOk, ok, okThen } from '../../types/result/module.f.js'
import { tagged, untagged } from '../../text/marked/module.f.mjs'
import {
    bindingTagged, braced as serializerBraced, op1Rust as serializerOp1Rust, op2Rust as serializerOp2Rust,
    op3Rust as serializerOp3Rust, scopeTagged as preparedScope, useLines as serializerUseLines,
    useLinesTagged as serializerUseLinesTagged, valueTagged,
} from '../../rust/serializer/module.f.mjs'

export const braced = serializerBraced
export const op1Rust = serializerOp1Rust
export const op2Rust = serializerOp2Rust
export const op3Rust = serializerOp3Rust
export const useLines = serializerUseLines
export const useLinesTagged = serializerUseLinesTagged

/** No override to a function's canonical representation. @type {(e: Exp) => string | undefined} */
const noText = () => undefined

/**
 * The fragment boundary owns synthetic invocation inputs; all ordinary nested
 * function bindings are checked by the graph owner before conversion.
 * @type {(a: Analysis) => string | null}
 */
const functionError = a => {
    for (const [i, node] of a.nodes.entries()) {
        if (node[0] !== '=>') { continue }
        const result = checked(a, i)
        if (result[0] === 'error') { return result[1] }
    }
    return null
}

/**
 * Bindings supplied to a fragment are not rediscovered by target serialization.
 * @type {(root: Exp, shared: readonly (readonly [Exp, string])[], text: (e: Exp) => string | undefined, runtime: string | null) => Result<{readonly block: Block, readonly external: readonly External[], readonly options: Options}, readonly unknown[]>}
 */
const converted = (root, shared, text, runtime) => {
    const analyzed = identityAnalysis(root)
    if (analyzed[0] === 'error') { return error([analyzed[1], root]) }
    const a = analyzed[1]
    const invalid = functionError(a)
    if (invalid !== null) { return error([invalid, root]) }
    const base = a.nodes.length + 0x100
    const width = a.nodes.length + 0x20
    const params = a.nodes.flatMap((n, i) => n[0] === 'arg' && a.scope[i] === -1 ? [n[1] + 1] : [])
    const frames = a.nodes.flatMap((n, i) => n[0] === 'frame' && a.scope[i] === -1 ? [n[1] + 1] : [])
    const parameters = Array.from({ length: Math.max(0, ...params) }, (_, i) => ({ index: base + i }))
    const captures = Array.from({ length: Math.max(0, ...frames) }, (_, i) => ({ index: base + width + i }))
    const args = { index: base + width * 2 }
    const rest = { index: base + width * 2 + 1 }
    const self = { index: base + width * 2 + 2 }
    const supplied = shared.flatMap(([node, name], i) => {
        const index = a.exps.indexOf(/** @type {import('../types.ts').ExpOp} */ (node))
        return index === -1 ? [] : [{ index, binding: { index: base + width * 3 + i }, text: name }]
    })
    /** @type {readonly External[]} */
    const external = [
        ...supplied,
        ...parameters.map((binding, i) => ({ binding, text: `args.argument(${tagged('number')(`${i}`)})` })),
        ...captures.map((binding, i) => ({ binding, text: `A::frame(self_)[${tagged('number')(`${i}`)}].clone()` })),
        { binding: args, text: 'args.clone().to_any()', uses: [['vm', 'ToAny']] },
        { binding: rest, text: 'rest.clone().to_any()', uses: [['vm', 'ToAny']] },
        { binding: self, text: 'Function::new(self_.clone()).to_any()', uses: [['vm', 'Function'], ['vm', 'ToAny']] },
    ]
    const block = prepare(fromAnalysis(a, supplied.map(e => [e.index, e.binding]), { parameters, captures, args, rest, self }))
    const options = { runtime: runtime !== null && needsRuntime(root) ? runtime : null, text: (/** @type {import('../../js/ast/prepare/types.ts').Function} */ fn) => text(a.exps[fn.target.index]) ?? functionStringify(fn) }
    return ok({ block, external, options })
}

/** The primitive/constructor cases expose values; operations expose Results. @type {(root: Exp) => boolean} */
const resultRoot = root => root instanceof Array && !isStatic(root) && !isIntrinsic(root)
    && !['undefined', 'args', 'arg', 'rest', 'frame', 'self', 'entry', 'hasEntry', '=>', '{}'].includes(root[0])
    && (root[0] !== '[]' || root[1].some(v => v instanceof Array && v[0] === '...'))

/**
 * One corpus expression, with named shared operands preserved by identity.
 * Eager nested operations use the corpus's Result-returning scope wrapper.
 * @type {(shared: readonly (readonly [Exp, string])[], runtime?: string | null) => (root: Exp) => Result<string, readonly unknown[]>}
 */
export const expExprTagged = (shared, runtime = null) => root => okThen(({ block, external, options }) => mapOk(([text]) => text)(valueTagged(['block', block], options, external, resultRoot(root))))(converted(root, shared, noText, runtime))

/** The same expression with presentation tags removed. @type {(shared: readonly (readonly [Exp, string])[], runtime?: string | null) => (root: Exp) => Result<string, readonly unknown[]>} */
export const expExpr = (shared, runtime = null) => root => mapOk(untagged)(expExprTagged(shared, runtime)(root))

/** A fragment with no externally supplied bindings. */
export const nodeExpr = expExpr([])

/** Helper expression with its import-use metadata. @type {(root: Exp) => Result<Printed<string>, readonly unknown[]>} */
export const helperExpr = root => okThen(({ block, options, external }) => valueTagged(['block', block], options, external, resultRoot(root)))(converted(root, [], noText, null))

/** A graph scope through the common conversion and preparation passes. @type {(root: Exp, text?: (e: Exp) => string | undefined, runtime?: string | null) => Result<Scope, readonly unknown[]>} */
export const scopeTagged = (root, text = noText, runtime = null) => okThen(({ block, external, options }) => preparedScope(block, options, external))(converted(root, [], text, runtime))

/** Plain Rust for a graph scope. @type {(root: Exp, runtime?: string | null) => Result<Scope, readonly unknown[]>} */
export const scope = (root, runtime = null) => mapOk(({ lines, uses }) => ({ lines: lines.map(untagged), uses }))(scopeTagged(root, noText, runtime))

/** A corpus scope over its supplied names, through the same prepared serializer. @type {(shared: readonly (readonly [Exp, string])[], runtime?: string | null) => (root: Exp) => Result<readonly string[], readonly unknown[]>} */
export const statementsOf = (shared, runtime = null) => root => okThen(({ block, external, options }) => mapOk(({ lines }) => lines.map(untagged))(preparedScope(block, options, external)))(converted(root, shared, noText, runtime))

/** A corpus-supplied name uses the target's ordinary prepared binding spelling. @type {(shared: readonly (readonly [Exp, string])[], name: string, runtime?: string | null) => (root: Exp) => Result<string, readonly unknown[]>} */
export const bindingLine = (shared, name, runtime = null) => root => okThen(({ block, external, options }) => mapOk(([text]) => untagged(text))(bindingTagged(name, ['block', block], options, external)))(converted(root, shared, noText, runtime))

/** Compatibility spelling for a rest-array binding. @type {(length: number) => Printed<string>} */
export const restLine = length => [`${tagged('keyword')('let')} rest = args.rest(${tagged('number')(`${length}`)});`, []]

/** A graph's own-scope read metadata. @type {(tag: string) => (root: Exp) => boolean} */
const reads = tag => root => visit(operandsOf)([])(root).some(([node]) => node instanceof Array && node[0] === tag)

/** Whether a fragment reads invocation inputs. @type {(root: Exp) => boolean} */
export const readsArgs = root => reads('args')(root) || reads('arg')(root) || reads('rest')(root)
/** Whether a fragment reads its capture frame. @type {(root: Exp) => boolean} */
export const readsFrame = root => reads('frame')(root)
/** Whether a fragment reads its enclosing function. @type {(root: Exp) => boolean} */
export const readsSelf = root => reads('self')(root)

/** Function bodies participate in module capability metadata. @type {(node: readonly unknown[]) => readonly unknown[]} */
const withBodies = node => node[0] === '=>' ? [...operandsOf(node), node[3]] : operandsOf(node)

/** The public Rust VM capability required by a graph. @type {(root: Exp) => boolean} */
export const holdsFunction = root => visit(withBodies)([])(root).some(([node]) => node instanceof Array
    && (node[0] === '=>' || node[0] === 'entry' || node[0] === 'hasEntry' || isIntrinsic(node)))

/** @type {(step: StepOver<Exp, Index> | undefined, member: boolean) => boolean} */
const memberCall = (step, member) => step === undefined ? false : step[0] === '|.' ? memberCall(step[2], true) : member || memberCall(step[2], false)

/** Whether the graph's operation spelling uses the runtime argument. @type {(root: Exp) => boolean} */
export const needsRuntime = root => visit(withBodies)([])(root).some(([node]) => {
    if (isStatic(node)) { return true }
    const operation = /** @type {ExpOp} */ (node)
    switch (operation[0]) {
        case 'memberPresent': { return true }
        // the entry check calls the runtime's `in` body
        case 'in': { return true }
        case '.': case '?.': { return memberCall(operation[3], true) }
        case '?.()': { return memberCall(operation[3], false) }
        default: { return false }
    }
})
