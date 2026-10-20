/**
 * Interpret analyzed EDAG with an immutable cache of demanded shared nodes.
 * Each call starts a fresh cache while retaining evaluated captures by identity.
 * A call in tail position of a body is made in the invocation's place, so a
 * chain of tail calls holds one cache and one set of host frames at a time.
 *
 * A function value's body is restored from the table it was evaluated
 * from, so it holds the sharing that table has. An invoked body is read
 * into the identity table (`identityAnalysis`), as the compiler's
 * evaluation reads a module, so a function value holds its body's nodes
 * as the graph has them — one shared node one node, two equal nodes two —
 * and its text, `String(f)`, is the one every other executor writes.
 *
 * @module
 * @import { Exp, ExpOp, StepOver, ItemsOver, Over } from '../types.ts'
 * @import { Analysis, Node, Operand, Step } from '../analysis/types.ts'
 * @import { ValueResult } from '../value/control/types.ts'
 * @import { Body, Invoke, Outcome } from '../value/call/types.ts'
 * @import { Closure, Function as ValueFunction, Runtime, Values, Array as ValueArray } from '../value/types.ts'
 * @import { Invocation } from './types.ts'
 * @import { Context, Evaluation, Tail } from '../operations/types.ts'
 * @import { _Cache } from './private.ts'
 */

import { assertOk } from '../../asserts/module.f.js'
import { isArray } from '../../types/array/module.f.mjs'
import { ok, unwrap } from '../../types/result/module.f.js'
import { checked, identityAnalysis } from '../analysis/module.f.mjs'
import { isIntrinsic, isStatic } from '../module.f.mjs'
import { entryCall, hasEntryCall, intrinsicCall, operation, staticCall } from '../operations/module.f.mjs'
import { invoker, settle } from '../value/call/module.f.mjs'

/** Restore one operand from the already restored prefix of the analysis. @type {(code: readonly ExpOp[], operand: Operand) => Exp} */
const expression = (code, operand) => isArray(operand) ? code[operand[1]] : operand

/** @type {(code: readonly ExpOp[], items: ItemsOver<Operand>) => ItemsOver<Exp>} */
const codeItems = (code, items) => items.map(item => isArray(item) && item[0] === '...'
    ? ['...', expression(code, item[1])] : expression(code, item))

/** @type {(code: readonly ExpOp[], step: Step) => StepOver<Exp>} */
const codeStep = (code, step) => {
    const [tag, operand, continuation] = step
    if (tag === '|.') {
        const key = expression(code, operand)
        return continuation === undefined ? [tag, key] : [tag, key, codeStep(code, continuation)]
    }
    const args = codeItems(code, operand)
    if (tag === '|!()') { return [tag, args] }
    return continuation === undefined ? [tag, args] : [tag, args, codeStep(code, continuation)]
}

/** Restore code, retaining table sharing, for the bodies carried by values. @type {(code: readonly ExpOp[], node: Node) => ExpOp} */
const codeNode = (code, node) => {
    switch (node[0]) {
        case '[]': { return ['[]', codeItems(code, node[1])] }
        case '{}': { return ['{}', node[1].map(p => p[0] === '...'
            ? ['...', expression(code, p[1])]
            : [':', expression(code, p[1]), expression(code, p[2])])] }
        case '=>': { return ['=>', node[1], node[2].map(x => expression(code, x)), expression(code, node[3])] }
        case ',': { return [',', node[1].map(x => expression(code, x))] }
        case '()': { return ['()', expression(code, node[1]), codeItems(code, node[2])] }
        case '?.()': {
            const [, callee, args, continuation] = node
            const head = /** @type {const} */ (['?.()', expression(code, callee), codeItems(code, args)])
            return /** @type {ExpOp} */ (continuation === undefined ? head : [...head, codeStep(code, continuation)])
        }
        case '.': case '?.': {
            const [tag, receiver, key, continuation] = node
            const head = /** @type {const} */ ([tag, expression(code, receiver), expression(code, key)])
            return /** @type {ExpOp} */ (continuation === undefined ? head : [...head, codeStep(code, continuation)])
        }
        default: {
            // All remaining tuples contain only metadata, primitives and
            // operand references, with no lists or continuation productions.
            return /** @type {ExpOp} */ (/** @type {unknown} */ (node.map(part => isArray(part) ? expression(code, part) : part)))
        }
    }
}

/** The root in tail position: its value, or the call it leaves. @type {(a: Analysis, context: Context, root: Operand) => Outcome} */
const evaluate = (a, context, root) => {
    const { nodes, shared } = a
    const invoke = invokeWith(context.runtime)
    const settled = settle(invoke)
    const code = nodes.reduce((/** @type {readonly ExpOp[]} */ prefix, node) => [...prefix, codeNode(prefix, node)], [])

    /** A shared node's established value, where it has one. @type {(index: number, cache: _Cache) => Evaluation<_Cache> | undefined} */
    const established = (index, cache) => {
        const entry = cache.find(([i]) => i === index)
        return entry === undefined ? undefined : [cache, ok(entry[1])]
    }

    /**
     * Retain a shared node's value once run — a call it leaves is not
     * retained, as the invocation ends with it.
     * @template {Outcome} R
     * @param {number} index
     * @param {_Cache} cache
     * @param {R} outcome
     * @returns {readonly [_Cache, R]}
     */
    const retained = (index, cache, outcome) =>
        [outcome[0] === 'ok' && shared.includes(index) ? [...cache, [index, outcome[1]]] : cache, outcome]

    // `operand` and `tail` each call `run` themselves rather than through
    // one helper taking the settling as a parameter: that helper would be
    // one more host frame per level of a nested graph, the margin
    // `../todo/stack-safety.md` counts.

    /** @type {(operand: Operand, cache: _Cache) => Evaluation<_Cache>} */
    const operand = (operand, cache) => {
        if (!isArray(operand)) { return [cache, ok(operand)] }
        const [, index] = operand
        const found = established(index, cache)
        if (found !== undefined) { return found }
        const [next, outcome] = run(nodes[index], cache)
        return retained(index, next, settled(outcome))
    }

    /** @type {(operand: Operand, cache: _Cache) => Tail<_Cache>} */
    const tail = (operand, cache) => {
        if (!isArray(operand)) { return [cache, ok(operand)] }
        const [, index] = operand
        const found = established(index, cache)
        if (found !== undefined) { return found }
        const [next, outcome] = run(nodes[index], cache)
        return retained(index, next, outcome)
    }

    const run = operation({ context, operand, tail, expression: e => expression(code, e), invoke })
    return tail(root, [])[1]
}

/**
 * The invoker of an executor given `runtime`: a represented function
 * invoked — its body evaluated with fresh state and retained captures
 * under the same runtime; a static function's body found in the runtime
 * and evaluated with the static as its `self`; or the `entry` helper,
 * which has no body, answered in place — and every call the body leaves
 * in tail position, made in its place.
 *
 * @type {(runtime: Runtime | undefined) => Invoke}
 */
export const invokeWith = runtime => {
    /** @type {(fn: Closure, fixed: Values, rest: ValueArray, self: ValueFunction) => Outcome} */
    const run = (fn, fixed, rest, self) => {
        const a = assertOk(identityAnalysis(fn))
        const [, index] = /** @type {import('../analysis/types.ts').Ref} */ (a.root)
        const [, , , root] = /** @type {Over<import('../types.ts').Function, Operand>} */ (a.nodes[index])
        return evaluate(a, { frame: fn[2], args: [], fixed, rest, self, runtime }, root)
    }
    /** @type {Body} */
    const body = (fn, fixed, rest) => fn[0] === 'entry' ? entryCall(fixed, invoke)
        : fn[0] === 'hasEntry' ? hasEntryCall(fixed, invoke)
        : isIntrinsic(fn) ? intrinsicCall(fn, fixed, invoke)
        : isStatic(fn) ? staticCall(runtime, fn, rest, run, invoke)
        : run(fn, fixed, rest, fn)
    const invoke = invoker(body)
    return invoke
}

/** {@link invokeWith} no runtime: every member function it answers is one the dispatcher implements natively. @type {Invoke} */
export const invoke = invokeWith(undefined)

/** Interpret a complete analyzed graph. Binding admission happens once here. @type {(a: Analysis) => (context: Invocation) => ValueResult} */
export const memo = a => {
    const table = unwrap(checked(a))
    return context => settle(invokeWith(context.runtime))(evaluate(table, { ...context, frame: [] }, table.root))
}
