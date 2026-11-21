/**
 * Interpret analyzed EDAG with an immutable cache of demanded shared nodes.
 * Each call starts a fresh cache while retaining evaluated captures by identity.
 * A call in tail position of a body is made in the invocation's place, so a
 * chain of tail calls holds one cache and one set of host frames at a time.
 *
 * A function value's body is the expression the table it was evaluated
 * from gives for it, the analysis's `exps`, so it holds the sharing that
 * table has. An invoked body is evaluated as the graph has it, a node its
 * own key — one shared node one value, two equal nodes two, as the identity
 * table (`identityAnalysis`) counts them — without that table being built:
 * a call reads the nodes it reaches and no others. A function value holds
 * its body's own nodes, and its text, `String(f)`, is the one every other
 * executor writes.
 *
 * @module
 * @import { Exp, ExpOp } from '../types.ts'
 * @import { EdagValue } from '../value/types.ts'
 * @import { RefMap } from '../../types/ref_map/types.ts'
 * @import { Analysis, Operand } from '../analysis/types.ts'
 * @import { ValueResult } from '../value/control/types.ts'
 * @import { Invoke, Outcome } from '../value/call/types.ts'
 * @import { Runtime } from '../value/types.ts'
 * @import { Invocation } from './types.ts'
 * @import { Context, Evaluation, Tail } from '../operations/types.ts'
 * @import { _Cache } from './private.ts'
 */

import { isArray } from '../../types/array/module.f.js'
import { identity } from '../../types/function/module.f.js'
import { empty as none } from '../../types/ref_map/module.f.js'
import { ok, unwrap } from '../../types/result/module.f.js'
import { checked } from '../analysis/module.f.js'
import { invokerWith, moduleArgs, operation } from '../operations/module.f.js'
import { settle } from '../value/call/module.f.js'

/** The root in tail position: its value, or the call it leaves. @type {(a: Analysis, context: Context, root: Operand, invoke: Invoke) => Outcome} */
const evaluate = (a, context, root, invoke) => {
    const { nodes, shared, exps } = a
    const settled = settle(invoke)
    const args = moduleArgs(context)

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

    /** A function's body as the table's expression. @type {(e: Operand) => Exp} */
    const expression = e => isArray(e) ? exps[Number(e[1])] : e

    // `tail` holds `operand` and each builds its own `run`, so that the only
    // name either reads before it is established is a function's own: a
    // later `const` is not readable
    // (`../../../spec/todo/3140-forward-references.md`). The two settle
    // differently and share no helper taking the settling as a parameter:
    // that helper would be one more host frame per level of a nested graph,
    // the margin `../todo/stack-safety.md` counts.

    /** @type {(operand: Operand, cache: _Cache) => Tail<_Cache>} */
    const tail = (root, cache) => {
        /** @type {(e: Operand, cache: _Cache) => Evaluation<_Cache>} */
        const operand = (e, cache) => {
            if (!isArray(e)) { return [cache, ok(e)] }
            const [, index] = e
            const found = established(index, cache)
            if (found !== undefined) { return found }
            const [next, outcome] = operation({ context, moduleArgs: args, operand, tail, expression, invoke })(nodes[Number(index)], cache)
            return retained(index, next, settled(outcome))
        }
        if (!isArray(root)) { return [cache, ok(root)] }
        const [, index] = root
        const found = established(index, cache)
        if (found !== undefined) { return found }
        const [next, outcome] = operation({ context, moduleArgs: args, operand, tail, expression, invoke })(nodes[Number(index)], cache)
        return retained(index, next, outcome)
    }

    return tail(root, [])[1]
}

/** Nodes that read what the invocation already holds: nothing to compute, so nothing to keep. */
const reads = /** @type {readonly string[]} */ (['arg', 'rest', 'frame', 'self', 'args', 'undefined'])

/**
 * An invoked body in tail position, evaluated as the graph has it: a node
 * is its own key, so one shared node is one value and two equal nodes are
 * two, as the identity table would count them. Every value a node answers
 * is kept by that node for the invocation, a shared one among them, and a
 * call it leaves is not, as the invocation ends with it.
 *
 * Nothing is read before it is needed. A table of the function would walk
 * its whole body, every nested body and every value it captured, on each
 * call, to learn which nodes are shared; keeping every value asks nothing
 * of the nodes an invocation never reaches.
 *
 * @type {(context: Context, root: Exp, invoke: Invoke) => Outcome}
 */
const body = (context, root, invoke) => {
    const settled = settle(invoke)
    const args = moduleArgs(context)

    /**
     * @template {Outcome} R
     * @param {ExpOp} e
     * @param {RefMap} kept
     * @param {R} outcome
     * @returns {readonly [RefMap, R]}
     */
    const retained = (e, kept, outcome) =>
        [outcome[0] === 'ok' && !reads.includes(e[0]) ? kept(e, outcome[1])[1] : kept, outcome]

    // As in `evaluate`: `tail` holds `operand`, and the two settle
    // differently without a helper taking the settling as a parameter.

    /** @type {(e: Exp, kept: RefMap) => Tail<RefMap>} */
    const tail = (root, kept) => {
        /** @type {(e: Exp, kept: RefMap) => Evaluation<RefMap>} */
        const operand = (e, kept) => {
            if (!isArray(e)) { return [kept, ok(e)] }
            const [found] = kept(e)
            if (found !== undefined) { return [kept, ok(/** @type {EdagValue} */ (found))] }
            const [next, outcome] = operation({ context, moduleArgs: args, operand, tail, expression: identity, invoke })(e, kept)
            return retained(e, next, settled(outcome))
        }
        if (!isArray(root)) { return [kept, ok(root)] }
        const [found] = kept(root)
        if (found !== undefined) { return [kept, ok(/** @type {EdagValue} */ (found))] }
        const [next, outcome] = operation({ context, moduleArgs: args, operand, tail, expression: identity, invoke })(root, kept)
        return retained(root, next, outcome)
    }

    return tail(root, none)[1]
}

/**
 * The invoker of an executor given `runtime`, its closure bodies evaluated
 * as the graph has them, with fresh state and retained captures under each
 * invocation's context ({@link invokerWith}).
 *
 * @type {(runtime: Runtime | undefined) => Invoke}
 */
export const invokeWith = runtime => invokerWith((fn, context) => body(context, fn[3], invokeWith(context.runtime)))(runtime)

/** {@link invokeWith} no runtime: every member function it answers is one the dispatcher implements natively. @type {Invoke} */
export const invoke = invokeWith(undefined)

/** Interpret a complete analyzed graph. Binding admission happens once here. @type {(a: Analysis) => (context: Invocation) => ValueResult} */
export const memo = a => {
    const table = unwrap(checked(a))
    return context => {
        const invoke = invokeWith(context.runtime)
        return settle(invoke)(evaluate(table, { ...context, frame: [] }, table.root, invoke))
    }
}
