/**
 * Interpret analyzed EDAG with an immutable cache of demanded shared nodes.
 * Each call starts a fresh cache while retaining evaluated captures by identity.
 * A call in tail position of a body is made in the invocation's place, so a
 * chain of tail calls holds one cache and one set of host frames at a time.
 *
 * A function value's body is the expression the table it was evaluated
 * from gives for it, the analysis's `exps`, so it holds the sharing that
 * table has. An invoked body is read into the identity table
 * (`identityAnalysis`), as the compiler's evaluation reads a module, so a
 * function value holds its body's nodes as the graph has them — the graph's
 * own nodes, one shared node one node, two equal nodes two — and its text,
 * `String(f)`, is the one every other executor writes.
 *
 * @module
 * @import { Over } from '../types.ts'
 * @import { Analysis, Operand } from '../analysis/types.ts'
 * @import { ValueResult } from '../value/control/types.ts'
 * @import { Invoke, Outcome } from '../value/call/types.ts'
 * @import { Runtime } from '../value/types.ts'
 * @import { Invocation } from './types.ts'
 * @import { Context, Evaluation, Tail } from '../operations/types.ts'
 * @import { _Cache } from './private.ts'
 */

import { assertOk } from '../../asserts/module.f.js'
import { isArray } from '../../types/array/module.f.mjs'
import { ok, unwrap } from '../../types/result/module.f.js'
import { checked, identityAnalysis } from '../analysis/module.f.mjs'
import { invokerWith, operation } from '../operations/module.f.mjs'
import { settle } from '../value/call/module.f.mjs'

/** The root in tail position: its value, or the call it leaves. @type {(a: Analysis, context: Context, root: Operand) => Outcome} */
const evaluate = (a, context, root) => {
    const { nodes, shared, exps } = a
    const invoke = invokeWith(context.runtime)
    const settled = settle(invoke)

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

    const run = operation({ context, operand, tail, expression: e => isArray(e) ? exps[e[1]] : e, invoke })
    return tail(root, [])[1]
}

/**
 * The invoker of an executor given `runtime`, its closure bodies read into
 * the identity table and evaluated with fresh state and retained captures
 * under each invocation's context ({@link invokerWith}).
 *
 * @type {(runtime: Runtime | undefined) => Invoke}
 */
export const invokeWith = invokerWith((fn, context) => {
    const a = assertOk(identityAnalysis(fn))
    const [, index] = /** @type {import('../analysis/types.ts').Ref} */ (a.root)
    const [, , , root] = /** @type {Over<import('../types.ts').Function, Operand>} */ (a.nodes[index])
    return evaluate(a, context, root)
})

/** {@link invokeWith} no runtime: every member function it answers is one the dispatcher implements natively. @type {Invoke} */
export const invoke = invokeWith(undefined)

/** Interpret a complete analyzed graph. Binding admission happens once here. @type {(a: Analysis) => (context: Invocation) => ValueResult} */
export const memo = a => {
    const table = unwrap(checked(a))
    return context => settle(invokeWith(context.runtime))(evaluate(table, { ...context, frame: [] }, table.root))
}
