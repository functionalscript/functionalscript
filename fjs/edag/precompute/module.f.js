/**
 * An experiment: evaluate once what a function computes the same way in
 * every call ([`../todo/precompute-closed-nodes.md`](../todo/precompute-closed-nodes.md)).
 *
 * A closure's captures are evaluated, so its frame is constant. A node of
 * its body is **closed** when it reaches no `['arg', N]`, `['rest']` or
 * `['self']`: its value is decided before any call. `precompute` evaluates
 * each closed node an open one reads, and the body where it is closed
 * itself, once, in one invocation over the closure's captures, calls
 * included:
 *
 * - a failure leaves the node where it is, so the function fails where and
 *   when it did;
 * - a primitive replaces the node;
 * - an array, an object or a function becomes one more capture, and the
 *   body reads it as `['frame', k]`.
 *
 * A capture the body no longer reads is dropped.
 *
 * The answer is an ordinary value every executor runs. It differs from the
 * one given only in what the
 * [value-identity proposal](../../../spec/todo/value-identity.md) leaves
 * unspecified: two calls can answer one array, object or function where
 * they answered two.
 *
 * **Not reached.** The body of a nested function whose slots are open is
 * left as written, and a value a precomputation answers is not precomputed
 * in turn. A closed call that does not end, does not end here.
 *
 * @module
 *
 * @import { Exp } from '../types.ts'
 * @import { Closure, EdagValue, Runtime, Values } from '../value/types.ts'
 * @import { Node, Operand } from '../analysis/types.ts'
 * @import { PersistentMap } from '../../types/map/types.ts'
 * @import { RefMap } from '../../types/ref_map/types.ts'
 */

import { assertNotNullish } from '../../asserts/module.f.js'
import { empty as noExps, mapGet, mapSet } from '../../types/map/module.f.js'
import { empty as none } from '../../types/ref_map/module.f.js'
import { unwrap } from '../../types/result/module.f.js'
import { identityAnalysis, ownOperandsOf, restoreNode } from '../analysis/module.f.js'
import { eachWith } from '../memo/module.f.js'

/** The reads an invocation decides. */
const open = /** @type {readonly string[]} */ (['arg', 'rest', 'self'])

/** The entries operands name. @type {(operands: readonly Operand[]) => readonly number[]} */
const named = operands => operands.flatMap(x => x instanceof Array ? [x[1]] : [])

/** Whether a node computes anything: a read of a slot and a node with no operand at all do not. @type {(node: Node) => boolean} */
const computes = node => node.length > 1 && node[0] !== 'frame'

/**
 * The closure without the captures its body does not read, the reads
 * renumbered: a call made ahead leaves the function it called unread, and
 * a writer refuses a slot no read reaches.
 *
 * @type {(fn: Closure) => Closure}
 */
const prune = fn => {
    const [, length, captures, body] = fn
    const { nodes, scope, exps } = unwrap(identityAnalysis(['=>', length, captures.map(() => null), body]))
    const self = nodes.length - 1
    const used = nodes.flatMap((node, i) => scope[Number(i)] === self && node[0] === 'frame' ? [node[1]] : [])
    const kept = captures.flatMap((_, i) => used.includes(i) ? [i] : [])
    if (kept.length === captures.length) { return fn }
    const built = nodes.reduce(
        (/** @type {PersistentMap<number, Exp>} */ before, node, i) => mapSet(before, i,
            scope[Number(i)] !== self ? exps[Number(i)]
            : node[0] === 'frame' ? ['frame', kept.indexOf(node[1])]
            : restoreNode(before, node)),
        noExps)
    return ['=>', length, kept.map(i => captures[Number(i)]), body instanceof Array ? assertNotNullish(mapGet(built, self - 1)) : body]
}

/**
 * The closure with its closed nodes evaluated, or the closure itself where
 * nothing was.
 *
 * @type {(runtime: Runtime | undefined) => (fn: Closure) => Closure}
 */
const closure = runtime => fn => {
    const [, length, captures, body] = fn
    const [kind, table] = identityAnalysis(['=>', length, captures.map(() => null), body])
    // A body the analysis refuses, and a primitive one, stay as they are.
    if (kind === 'error' || table.nodes.length < 2) { return fn }
    const { nodes, scope, exps } = table
    // The function is the last entry, and its body the one before it.
    const self = nodes.length - 1
    const root = self - 1

    // A node follows its operands, so each is decided by the ones before it.
    const closed = nodes.reduce(
        (/** @type {readonly boolean[]} */ before, node, i) =>
            [...before, scope[Number(i)] === self && !open.includes(node[0]) && named(ownOperandsOf(node)).every(j => before[Number(j)])],
        [])

    /** What an open node of the body reads, and the body. */
    const read = [root, ...nodes.flatMap((node, i) => scope[Number(i)] === self && !closed[Number(i)] ? named(ownOperandsOf(node)) : [])]
    const points = nodes.flatMap((node, i) => closed[Number(i)] && computes(node) && read.includes(i) ? [i] : [])
    const results = eachWith(runtime)(captures, points.map(i => exps[Number(i)]))

    /** @type {PersistentMap<number, Exp>} */
    let built = noExps
    /** @type {Values} */
    let lifted = []
    let changed = false
    for (let i = 0; i < nodes.length; i += 1) {
        const point = points.indexOf(i)
        const result = point === -1 ? undefined : results[Number(point)]
        if (result !== undefined && result[0] === 'ok') {
            const value = result[1]
            changed = true
            if (!(value instanceof Array)) {
                built = mapSet(built, i, value)
            } else if (value[0] === 'undefined') {
                // a node of this body's own, as the scope rule asks
                built = mapSet(built, i, ['undefined'])
            } else {
                built = mapSet(built, i, ['frame', captures.length + lifted.length])
                lifted = [...lifted, value]
            }
        } else {
            built = mapSet(built, i, scope[Number(i)] === self && !closed[Number(i)] ? restoreNode(built, nodes[Number(i)]) : exps[Number(i)])
        }
    }
    return changed ? prune(['=>', length, [...captures, ...lifted], assertNotNullish(mapGet(built, root))]) : fn
}

/**
 * The values of a container in order, the answered ones threaded through.
 *
 * @type {(one: (seen: RefMap, value: EdagValue) => readonly [RefMap, EdagValue]) => (seen: RefMap, values: Values) => readonly [RefMap, Values]}
 */
const each = one => (seen, values) => {
    /** @type {Values} */
    let items = []
    for (const value of values) {
        const [next, item] = one(seen, value)
        seen = next
        items = [...items, item]
    }
    return [seen, items]
}

/**
 * `value` with every closure in it precomputed over its precomputed
 * captures. A value reached twice is answered once, so what was one array,
 * object or function is one still. The answer is a new value throughout;
 * the one given is left as it was.
 * `runtime` answers the member and static functions a closed call makes,
 * as it does for [`memo`](../memo/module.f.js).
 *
 * @type {(runtime: Runtime | undefined) => (value: EdagValue) => EdagValue}
 */
export const precompute = runtime => {
    const one = closure(runtime)
    /** @type {(seen: RefMap, value: EdagValue) => readonly [RefMap, EdagValue]} */
    const walk = (seen, value) => {
        if (!(value instanceof Array)) { return [seen, value] }
        const [known] = seen(value)
        if (known !== undefined) { return [seen, /** @type {EdagValue} */ (known)] }
        switch (value[0]) {
            case '[]': {
                const [next, items] = each(walk)(seen, value[1])
                /** @type {EdagValue} */
                const result = ['[]', items]
                return [next(value, result)[1], result]
            }
            case '{}': {
                const [next, items] = each(walk)(seen, value[1].map(([, , item]) => item))
                /** @type {EdagValue} */
                const result = ['{}', value[1].map(([, key], i) => [':', key, items[Number(i)]])]
                return [next(value, result)[1], result]
            }
            case '=>': {
                const [next, slots] = each(walk)(seen, value[2])
                const result = one(['=>', value[1], slots, value[3]])
                return [next(value, result)[1], result]
            }
            // `undefined`, a helper and a built-in have nothing to precompute
            default: { return [seen, value] }
        }
    }
    return value => walk(none, value)[1]
}
