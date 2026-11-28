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
 * @import { Closure, EdagValue, Values } from '../value/types.ts'
 * @import { Analysis, Operand } from '../analysis/types.ts'
 * @import { ValueResult } from '../value/control/types.ts'
 * @import { Invoke, Outcome } from '../value/call/types.ts'
 * @import { Runtime } from '../value/types.ts'
 * @import { Invocation } from './types.ts'
 * @import { Context, Evaluation, Tail } from '../operations/types.ts'
 * @import { _Cache, _Kept, _State, _Steps } from './private.ts'
 */

import { isArray } from '../../types/array/module.f.js'
import { identity } from '../../types/function/module.f.js'
import { empty as none } from '../../types/ref_map/module.f.js'
import { error, ok, unwrap } from '../../types/result/module.f.js'
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

/** What a node answers where no step is left to evaluate it. @type {ValueResult} */
const stopped = error(['undefined'])

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
 * The evaluator of one invocation, as the graph has it: a node is its own
 * key, so one shared node is one value and two equal nodes are two, as the
 * identity table would count them. Every value a node answers is kept by
 * that node for the invocation, a shared one among them, and a call it
 * leaves is not, as the invocation ends with it.
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
 * **Steps.** The state holds how many nodes the invocation may still
 * evaluate, one fewer after each, and a node met at none fails as a throw
 * does. `call` makes the call a node leaves where its value is needed now,
 * and answers what is left after it, so the count travels through every
 * call made that way. An ordinary invocation starts with `Infinity`, which
 * no evaluation lowers.
 *
 * @type {(context: Context, invoke: Invoke, call: (outcome: Outcome, steps: number) => readonly [number, ValueResult]) => {
 *  readonly operand: (e: Exp, state: _Steps) => Evaluation<_Steps>
 *  readonly tail: (root: Exp, state: _Steps) => Tail<_Steps>
 *  readonly start: (steps: number) => _Steps
 * }}
 */
const invocation = (context, invoke, call) => {
    const args = moduleArgs(context)

    /**
     * @template {Outcome} R
     * @param {ExpOp} e
     * @param {_Steps} state
     * @param {R} outcome
     * @returns {readonly [_Steps, R]}
     */
    const retained = (e, [values, run, steps], outcome) =>
        [[outcome[0] === 'ok' && !reads.includes(e[0]) ? keep(values, e, outcome[1]) : values, run, steps], outcome]

    // As in `evaluate`: the evaluator is built once and travels in the
    // state.

    /** @type {(e: Exp, state: _Steps) => Evaluation<_Steps>} */
    const operand = (e, state) => {
        if (!isArray(e)) { return [state, ok(e)] }
        const found = kept(state[0], e)
        if (found !== undefined) { return [state, ok(found)] }
        const [values, run, steps] = state
        if (steps === 0) { return [state, stopped] }
        const [next, outcome] = run(e, [values, run, steps - 1])
        const [left, result] = call(outcome, next[2])
        return retained(e, [next[0], next[1], left], result)
    }

    /** @type {(root: Exp, state: _Steps) => Tail<_Steps>} */
    const tail = (root, state) => {
        if (!isArray(root)) { return [state, ok(root)] }
        const found = kept(state[0], root)
        if (found !== undefined) { return [state, ok(found)] }
        // a body is entered with a step left, so its root has one
        const [values, run, steps] = state
        const [next, outcome] = run(root, [values, run, steps - 1])
        return retained(root, next, outcome)
    }

    const run = operation({ context, moduleArgs: args, operand, tail, expression: identity, invoke })
    return { operand, tail, start: steps => [nothing, run, steps] }
}

/**
 * An invoked body in tail position, under {@link invocation}, uncounted.
 *
 * @type {(context: Context, root: Exp, invoke: Invoke) => Outcome}
 */
const body = (context, root, invoke) => {
    const settled = settle(invoke)
    const { tail, start } = invocation(context, invoke, (outcome, steps) => [steps, settled(outcome)])
    return tail(root, start(Infinity))[1]
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

/** How many invocations a counted call may be inside, so that a recursion ends before the host's stack does. */
const deep = /** @type {number} */ (64)

/**
 * The call an outcome leaves, made with `steps` to spend, and what is left
 * of them: a closure's body is evaluated under {@link invocation} with the
 * count, and each call it leaves in its place is made in turn, so neither a
 * recursion nor a loop of tail calls outlasts the count. `depth` is how
 * many invocations may still nest. A call met with neither left fails as a
 * throw does.
 *
 * What is not a closure — a helper, an intrinsic, a static function — is
 * answered as an ordinary invocation answers it, and a function such a
 * body, or a member function, calls back is given what was left when the
 * invocation around it began: each such call is bounded, their sum is not
 * counted.
 *
 * @type {(runtime: Runtime | undefined, depth: number) => (outcome: Outcome, steps: number) => readonly [number, ValueResult]}
 */
const counted = (runtime, depth) => (outcome, steps) => {
    while (outcome[0] === 'call') {
        if (steps === 0 || depth === 0) { return [steps, stopped] }
        const [, fn, fixed, rest] = outcome
        const within = counted(runtime, depth - 1)
        const allowance = steps
        /** @type {Invoke} */
        const invoke = (f, bound, remaining) => within(['call', f, bound, remaining], allowance)[1]
        /** @type {(f: Closure, context: Context) => Tail<_Steps>} */
        const run = (f, context) => {
            const { tail, start } = invocation(context, invoke, within)
            return tail(f[3], start(allowance))
        }
        if (fn[0] !== '=>') { return [steps, invokerWith((f, context) => run(f, context)[1])(runtime)(fn, fixed, rest)] }
        const [state, next] = run(fn, { frame: fn[2], args: [], fixed, rest, self: fn, runtime })
        steps = state[2]
        outcome = next
    }
    return [steps, outcome]
}

/**
 * Each of `roots` in order, in one invocation over `frame` with no
 * arguments and no `self`, with `steps` to spend between them: a node two
 * roots share is one value, and a root that fails leaves the roots after
 * it to their own answers. A root the count ends in fails, and so does
 * every root after it. The roots are nodes that read neither an argument
 * nor `self` ([`../precompute`](../precompute/module.f.js)).
 *
 * @type {(runtime: Runtime | undefined, steps: number) => (frame: Values, roots: readonly Exp[]) => readonly ValueResult[]}
 */
export const eachWith = (runtime, steps) => (frame, roots) => {
    const call = counted(runtime, deep)
    /** @type {Invoke} */
    const invoke = (fn, fixed, rest) => call(['call', fn, fixed, rest], steps)[1]
    const { operand, start } = invocation({ frame, args: [], fixed: [], rest: ['[]', []], runtime }, invoke, call)
    /** @type {readonly ValueResult[]} */
    let results = []
    let state = start(steps)
    for (const root of roots) {
        const [next, result] = operand(root, state)
        state = next
        results = [...results, result]
    }
    return results
}

/** Interpret a complete analyzed graph. Binding admission happens once here. @type {(a: Analysis) => (context: Invocation) => ValueResult} */
export const memo = a => {
    const table = unwrap(checked(a))
    return context => {
        const invoke = invokeWith(context.runtime)
        return settle(invoke)(evaluate(table, { ...context, frame: [] }, table.root, invoke))
    }
}
