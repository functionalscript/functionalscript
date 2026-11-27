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
 * @import { Analysis, Operand } from '../analysis/types.ts'
 * @import { ValueResult } from '../value/control/types.ts'
 * @import { Invoke, Outcome } from '../value/call/types.ts'
 * @import { Runtime } from '../value/types.ts'
 * @import { Invocation } from './types.ts'
 * @import { Context, Evaluation, Tail } from '../operations/types.ts'
 * @import { _Cache, _Kept, _State } from './private.ts'
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

    /** A shared node's established value, where it has one. @type {(index: number, state: _State<_Cache, Operand>) => Evaluation<_State<_Cache, Operand>> | undefined} */
    const established = (index, state) => {
        const entry = state[0].find(([i]) => i === index)
        return entry === undefined ? undefined : [state, ok(entry[1])]
    }

    /**
     * Retain a shared node's value once run — a call it leaves is not
     * retained, as the invocation ends with it.
     * @template {Outcome} R
     * @param {number} index
     * @param {_State<_Cache, Operand>} state
     * @param {R} outcome
     * @returns {readonly [_State<_Cache, Operand>, R]}
     */
    const retained = (index, [cache, run], outcome) =>
        [[outcome[0] === 'ok' && shared.includes(index) ? [...cache, [index, outcome[1]]] : cache, run], outcome]

    /** A function's body as the table's expression. @type {(e: Operand) => Exp} */
    const expression = e => isArray(e) ? exps[Number(e[1])] : e

    // The evaluator is built once for the invocation and travels in the
    // state, beside the cache. `operand` and `tail` are what it is built
    // from and each calls it by reading the value handed to it in the
    // state. The two settle differently and
    // share no helper taking the settling as a parameter: that helper would
    // be one more host frame per level of a nested graph, the margin
    // `../todo/stack-safety.md` counts.

    /** @type {(e: Operand, state: _State<_Cache, Operand>) => Evaluation<_State<_Cache, Operand>>} */
    const operand = (e, state) => {
        if (!isArray(e)) { return [state, ok(e)] }
        const [, index] = e
        const found = established(index, state)
        if (found !== undefined) { return found }
        const [next, outcome] = state[1](nodes[Number(index)], state)
        return retained(index, next, settled(outcome))
    }

    /** @type {(root: Operand, state: _State<_Cache, Operand>) => Tail<_State<_Cache, Operand>>} */
    const tail = (root, state) => {
        if (!isArray(root)) { return [state, ok(root)] }
        const [, index] = root
        const found = established(index, state)
        if (found !== undefined) { return found }
        const [next, outcome] = state[1](nodes[Number(index)], state)
        return retained(index, next, outcome)
    }

    return tail(root, [[], operation({ context, moduleArgs: args, operand, tail, expression, invoke })])[1]
}

/** Nodes that read what the invocation already holds: nothing to compute, so nothing to keep. */
const reads = /** @type {readonly string[]} */ (['arg', 'rest', 'frame', 'self', 'args', 'undefined'])

/** How many values an invocation keeps in a list before it keeps the rest in a reference map. */
const few = /** @type {number} */ (16)

/** An invocation that has kept nothing. */
const nothing = /** @type {_Kept} */ ([0, null, none])

/** The value kept for a node, or `undefined`. @type {(kept: _Kept, e: ExpOp) => EdagValue | undefined} */
const kept = ([size, pairs, rest], e) => {
    let at = pairs
    while (at !== null) {
        if (at[0] === e) { return at[1] }
        at = at[2]
    }
    return size > few ? /** @type {EdagValue | undefined} */ (rest(e)[0]) : undefined
}

/** `kept` with a node's value kept as well. @type {(kept: _Kept, e: ExpOp, value: EdagValue) => _Kept} */
const keep = ([size, pairs, rest], e, value) =>
    size < few ? [size + 1, [e, value, pairs], rest] : [size + 1, pairs, rest(e, value)[1]]

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
 * Most invocations evaluate a handful of nodes, and a reference map costs
 * more to start than a handful of comparisons: the first values are kept in
 * a list searched with `===`, and only an invocation that keeps more than
 * {@link few} keeps the rest in a map.
 *
 * @type {(context: Context, root: Exp, invoke: Invoke) => Outcome}
 */
const body = (context, root, invoke) => {
    const settled = settle(invoke)
    const args = moduleArgs(context)

    /**
     * @template {Outcome} R
     * @param {ExpOp} e
     * @param {_State<_Kept, Exp>} state
     * @param {R} outcome
     * @returns {readonly [_State<_Kept, Exp>, R]}
     */
    const retained = (e, [values, run], outcome) =>
        [[outcome[0] === 'ok' && !reads.includes(e[0]) ? keep(values, e, outcome[1]) : values, run], outcome]

    // As in `evaluate`: the evaluator is built once and travels in the
    // state, and the two settle differently without a helper taking the
    // settling as a parameter.

    /** @type {(e: Exp, state: _State<_Kept, Exp>) => Evaluation<_State<_Kept, Exp>>} */
    const operand = (e, state) => {
        if (!isArray(e)) { return [state, ok(e)] }
        const found = kept(state[0], e)
        if (found !== undefined) { return [state, ok(found)] }
        const [next, outcome] = state[1](e, state)
        return retained(e, next, settled(outcome))
    }

    /** @type {(root: Exp, state: _State<_Kept, Exp>) => Tail<_State<_Kept, Exp>>} */
    const tail = (root, state) => {
        if (!isArray(root)) { return [state, ok(root)] }
        const found = kept(state[0], root)
        if (found !== undefined) { return [state, ok(found)] }
        const [next, outcome] = state[1](root, state)
        return retained(root, next, outcome)
    }

    return tail(root, [nothing, operation({ context, moduleArgs: args, operand, tail, expression: identity, invoke })])[1]
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
