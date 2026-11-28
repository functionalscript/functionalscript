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
 * A capture the body no longer reads is dropped, and so is an operand of
 * a comma that was there to be evaluated and has been.
 *
 * The answer is an ordinary value every executor runs. It differs from the
 * one given only in what the
 * [value-identity proposal](../../../spec/todo/value-identity.md) leaves
 * unspecified: two calls can answer one array, object or function where
 * they answered two.
 *
 * **Nested functions.** A nested function with an open slot has a frame
 * that is partly known: a slot holding a constant is, the rest are filled
 * at a call. Its body is reduced over the known ones, and a value it lifts
 * becomes a capture of the outermost closure, handed down through a slot.
 * `x => y => [x, y, table(64)]` builds the table once.
 *
 * **Not reached.** A value a precomputation answers is not precomputed in
 * turn, and `['self']` is open.
 *
 * @module
 *
 * @import { Exp } from '../types.ts'
 * @import { Closure, EdagValue, Runtime, Values } from '../value/types.ts'
 * @import { Node, Operand } from '../analysis/types.ts'
 * @import { PersistentMap } from '../../types/map/types.ts'
 * @import { RefMap } from '../../types/ref_map/types.ts'
 */

import { generate } from '../../types/array/module.f.js'
import { empty as noExps, mapGet, mapSet } from '../../types/map/module.f.js'
import { empty as none } from '../../types/ref_map/module.f.js'
import { ok, unwrap } from '../../types/result/module.f.js'
import { identityAnalysis, operandsOf, ownOperandsOf, restoreNode } from '../analysis/module.f.js'
import { eachWith } from '../memo/module.f.js'

/**
 * The expression built for an entry. It may be `null`, a node evaluated to
 * it, so the answer is read as it is.
 *
 * @type {(built: PersistentMap<number, Exp>, i: number) => Exp}
 */
const at = (built, i) => /** @type {Exp} */ (mapGet(built, i))

/** The reads an invocation decides. */
const open = /** @type {readonly string[]} */ (['arg', 'rest', 'self'])

/** The entries operands name. @type {(operands: readonly Operand[]) => readonly number[]} */
const named = operands => operands.flatMap(x => x instanceof Array ? [x[1]] : [])

/** Whether a node computes anything: a read of a slot and a node with no operand at all do not. @type {(node: Node) => boolean} */
const computes = node => node.length > 1 && node[0] !== 'frame'

/**
 * An entry over the expressions built for its operands: the node it was
 * where none of them changed, since what exists is never made again.
 *
 * @type {(built: PersistentMap<number, Exp>, exps: readonly Exp[], node: Node, i: number) => Exp}
 */
const rebuilt = (built, exps, node, i) =>
    named(operandsOf(node)).every(j => mapGet(built, j) === exps[Number(j)]) ? exps[Number(i)] : restoreNode(built, node)

/**
 * The slots a body needs, and the body reading them by their new places:
 * a slot the body does not read goes, since a call made ahead leaves the
 * function it called unread and a writer refuses a slot no read reaches.
 * A slot in `unknown` stays, read or not: it is filled at a call.
 *
 * @type {(length: number, count: number, unknown: readonly number[], body: Exp) => readonly [kept: readonly number[], body: Exp]}
 */
const prune = (length, count, unknown, body) => {
    const all = generate(count, i => i)
    const { nodes, scope, exps } = unwrap(identityAnalysis(['=>', length, all.map(() => null), body]))
    const self = nodes.length - 1
    const used = nodes.flatMap((node, i) => scope[Number(i)] === self && node[0] === 'frame' ? [node[1]] : [])
    const kept = all.filter(i => used.includes(i) || unknown.includes(i))
    if (kept.length === count) { return [kept, body] }
    const built = nodes.reduce(
        (/** @type {PersistentMap<number, Exp>} */ before, node, i) => mapSet(before, i,
            scope[Number(i)] !== self ? exps[Number(i)]
            : node[0] === 'frame' && kept.indexOf(node[1]) !== node[1] ? ['frame', kept.indexOf(node[1])]
            : rebuilt(before, exps, node, i)),
        noExps)
    return [kept, body instanceof Array ? at(built, self - 1) : body]
}

/**
 * A function whose slots each hold a value no other does: `first` is, for
 * each slot, the first slot holding its value, itself where it is the only
 * one. Answers the slots kept and the body reading them by their new
 * places, or `null` where every slot was the only one, here and in every
 * function the body makes. Two slots of one value are one capture: a
 * source function captures a value once, and a writer refuses a slot that
 * repeats another.
 *
 * @type {(length: number, first: readonly number[], body: Exp) => readonly [kept: readonly number[], body: Exp] | null}
 */
const single = (length, first, body) => {
    const kept = first.filter((slot, i) => slot === i)
    const [kind, table] = identityAnalysis(['=>', length, first.map(() => null), body])
    if (kind === 'error' || table.nodes.length < 2) { return null }
    const { nodes, scope, exps } = table
    const self = nodes.length - 1
    /** The place a read of a slot has among the slots kept. @type {(slot: number) => number} */
    const place = slot => kept.indexOf(first[Number(slot)])
    let changed = kept.length !== first.length
    /** @type {PersistentMap<number, Exp>} */
    let built = noExps
    for (let i = 0; i < nodes.length; i += 1) {
        const node = nodes[Number(i)]
        if (scope[Number(i)] !== self) {
            built = mapSet(built, i, exps[Number(i)])
        } else if (node[0] === 'frame' && place(node[1]) !== node[1]) {
            built = mapSet(built, i, ['frame', place(node[1])])
        } else if (node[0] === '=>') {
            // Two slots of a function the body makes hold one value where
            // both read one slot of this one.
            const [, innerLength, innerSlots, innerBody] = node
            const reads = innerSlots.map((x, j) => {
                const slot = x instanceof Array ? nodes[Number(x[1])] : null
                return slot !== null && slot[0] === 'frame' ? place(slot[1]) : -1 - j
            })
            const inner = single(
                innerLength,
                reads.map(read => reads.indexOf(read)),
                innerBody instanceof Array ? exps[Number(innerBody[1])] : innerBody)
            if (inner === null) {
                built = mapSet(built, i, rebuilt(built, exps, node, i))
            } else {
                const before = built
                const [innerKept, merged] = inner
                changed = true
                built = mapSet(built, i, ['=>', innerLength, innerKept.map(k => {
                    const x = innerSlots[Number(k)]
                    return x instanceof Array ? at(before, x[1]) : x
                }), merged])
            }
        } else {
            built = mapSet(built, i, rebuilt(built, exps, node, i))
        }
    }
    return changed ? [kept, at(built, self - 1)] : null
}

/**
 * A function over `slots`, the ones in `unknown` filled only at a call,
 * with the closed nodes of `body` evaluated: the slots it then has, each
 * by its place in `slots` followed by the values lifted, those values, and
 * the body; or `null` where nothing was evaluated.
 *
 * A nested function with an open slot is the same question one level
 * down: its closed slots are known, the rest are not, and a value its body
 * lifts is lifted here and handed to it through a slot.
 *
 * @type {(runtime: Runtime | undefined, steps: number) => (length: number, slots: Values, unknown: readonly number[], body: Exp) => readonly [kept: readonly number[], lifted: Values, body: Exp] | null}
 */
const reduce = (runtime, steps) => {
    /** @type {(length: number, slots: Values, unknown: readonly number[], body: Exp) => readonly [kept: readonly number[], lifted: Values, body: Exp] | null} */
    const go = (length, slots, unknown, body) => {
        const [kind, table] = identityAnalysis(['=>', length, slots.map(() => null), body])
        // A body the analysis refuses, and a primitive one, stay as they are.
        if (kind === 'error' || table.nodes.length < 2) { return null }
        const { nodes, scope, exps } = table
        // The function is the last entry, and its body the one before it.
        const self = nodes.length - 1
        const root = self - 1

        // A node follows its operands, so each is decided by the ones before it.
        const closed = nodes.reduce(
            (/** @type {readonly boolean[]} */ before, node, i) => [
                ...before,
                scope[Number(i)] === self
                    && !open.includes(node[0])
                    && !(node[0] === 'frame' && unknown.includes(node[1]))
                    && named(ownOperandsOf(node)).every(j => before[Number(j)]),
            ],
            [])

        /** What an open node of the body reads, and the body. */
        const read = [root, ...nodes.flatMap((node, i) => scope[Number(i)] === self && !closed[Number(i)] ? named(ownOperandsOf(node)) : [])]
        /** The closed nodes among them, each evaluated once. */
        const reached = nodes.flatMap((_, i) => closed[Number(i)] && read.includes(i) ? [i] : [])
        const results = eachWith(runtime, steps)(slots, reached.map(i => exps[Number(i)]))
        /** The nodes whose values replace them. */
        const done = reached.filter((i, at) => results[Number(at)][0] === 'ok' && computes(nodes[Number(i)]))

        /** @type {PersistentMap<number, Exp>} */
        let built = noExps
        /** @type {Values} */
        let lifted = []
        let changed = false
        for (let i = 0; i < nodes.length; i += 1) {
            const node = nodes[Number(i)]
            if (done.includes(i)) {
                const value = unwrap(results[Number(reached.indexOf(i))])
                changed = true
                if (!(value instanceof Array)) {
                    built = mapSet(built, i, value)
                } else if (value[0] === 'undefined') {
                    // a node of this body's own, as the scope rule asks
                    built = mapSet(built, i, ['undefined'])
                } else {
                    built = mapSet(built, i, ['frame', slots.length + lifted.length])
                    lifted = [...lifted, value]
                }
            } else if (scope[Number(i)] !== self || closed[Number(i)]) {
                built = mapSet(built, i, exps[Number(i)])
            } else if (node[0] === ',' && node[1].some((x, j, all) => j < all.length - 1 && x instanceof Array && done.includes(x[1]))) {
                // An operand before the last is there to be evaluated, and
                // one that has been is done: it goes, and a comma left with
                // its last operand alone is that operand.
                const before = built
                const left = node[1]
                    .filter((x, j, all) => j === all.length - 1 || !(x instanceof Array && done.includes(x[1])))
                    .map(x => x instanceof Array ? at(before, x[1]) : x)
                built = mapSet(built, i, left.length === 1 ? left[0] : [',', left])
            } else if (node[0] === '=>') {
                // A slot is known where it is a primitive or a closed node
                // that answered; the function is reduced over those.
                const [, innerLength, innerSlots, innerBody] = node
                const known = innerSlots.map(x => {
                    if (!(x instanceof Array)) { return ok(x) }
                    const at = reached.indexOf(x[1])
                    return at === -1 ? undefined : results[Number(at)]
                })
                const inner = go(
                    innerLength,
                    known.map(r => r !== undefined && r[0] === 'ok' ? r[1] : null),
                    known.flatMap((r, j) => r !== undefined && r[0] === 'ok' ? [] : [j]),
                    innerBody instanceof Array ? exps[Number(innerBody[1])] : innerBody)
                if (inner === null) {
                    built = mapSet(built, i, rebuilt(built, exps, node, i))
                } else {
                    const [kept, values, reduced] = inner
                    /** @type {readonly Exp[]} */
                    let handed = []
                    for (const k of kept) {
                        if (k < innerSlots.length) {
                            const x = innerSlots[Number(k)]
                            handed = [...handed, x instanceof Array ? at(built, x[1]) : x]
                        } else {
                            handed = [...handed, ['frame', slots.length + lifted.length]]
                            lifted = [...lifted, values[Number(k - innerSlots.length)]]
                        }
                    }
                    changed = true
                    built = mapSet(built, i, ['=>', innerLength, handed, reduced])
                }
            } else {
                built = mapSet(built, i, rebuilt(built, exps, node, i))
            }
        }
        if (!changed) { return null }
        const [kept, pruned] = prune(length, slots.length + lifted.length, unknown, at(built, root))
        return [kept, lifted, pruned]
    }
    return go
}

/**
 * The closure with its closed nodes evaluated, or the closure itself where
 * nothing was.
 *
 * @type {(runtime: Runtime | undefined, steps: number) => (fn: Closure) => Closure}
 */
const closure = (runtime, steps) => fn => {
    const [, length, captures, body] = fn
    const reduced = reduce(runtime, steps)(length, captures, [], body)
    if (reduced === null) { return fn }
    const [kept, lifted, result] = reduced
    const all = [...captures, ...lifted]
    return ['=>', length, kept.map(i => all[Number(i)]), result]
}

/** Whether each value is the one it was. @type {(before: Values, after: Values) => boolean} */
const same = (before, after) => after.every((value, i) => value === before[Number(i)])

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
 * A value with `fn` of every closure in it, each over the answers of its
 * captures, after the values `seen` has answered, and those with the ones
 * answered here: a value reached twice is answered once, in one call or
 * across calls, so what was one array, object or function is one still,
 * and a value answered is its own answer. What exists is never made again:
 * an array, an object or a function nothing changed in is answered as
 * itself.
 *
 * @type {(fn: (seen: RefMap, closure: Closure) => readonly [RefMap, EdagValue & object]) => (seen: RefMap, value: EdagValue) => readonly [RefMap, EdagValue]}
 */
const values = fn => {
    /** A value with its answer, and the answer as its own. @type {(seen: RefMap, value: EdagValue & object, result: EdagValue & object) => readonly [RefMap, EdagValue]} */
    const answer = (seen, value, result) => [seen(value, result)[1](result, result)[1], result]
    /** @type {(seen: RefMap, value: EdagValue) => readonly [RefMap, EdagValue]} */
    const walk = (seen, value) => {
        if (!(value instanceof Array)) { return [seen, value] }
        const [known] = seen(value)
        if (known !== undefined) { return [seen, /** @type {EdagValue} */ (known)] }
        switch (value[0]) {
            case '[]': {
                const [next, items] = each(walk)(seen, value[1])
                return answer(next, value, same(value[1], items) ? value : ['[]', items])
            }
            case '{}': {
                const [next, items] = each(walk)(seen, value[1].map(([, , item]) => item))
                return answer(next, value, same(value[1].map(([, , item]) => item), items) ? value
                    : ['{}', value[1].map((property, i) => property[2] === items[Number(i)] ? property : [':', property[1], items[Number(i)]])])
            }
            case '=>': {
                const [next, slots] = each(walk)(seen, value[2])
                const [last, result] = fn(next, same(value[2], slots) ? value : ['=>', value[1], slots, value[3]])
                return answer(last, value, result)
            }
            // `undefined`, a helper, a built-in and a function of a group
            default: { return [seen, value] }
        }
    }
    return walk
}

/**
 * A value with each closure in it capturing a value once ({@link single}).
 * Nothing is evaluated, so it ends on any value.
 */
const once = values((seen, fn) => {
    const [, length, slots, body] = fn
    const merged = single(length, slots.map((value, i) => value instanceof Array ? slots.indexOf(value) : i), body)
    return [seen, merged === null ? fn : ['=>', length, merged[0].map(i => slots[Number(i)]), merged[1]]]
})

/**
 * `value` with every closure in it precomputed over its precomputed
 * captures and capturing each value once, after the values `seen` has
 * answered, and those with the ones answered here ({@link values}).
 * `runtime` answers the member and static functions a closed call makes,
 * as it does for [`memo`](../memo/module.f.js).
 *
 * `steps` is how many nodes the closed nodes of one function may take to
 * evaluate between them: a node the count ends in is left where it is, as
 * a node that fails is, so a closed call that does not end is not waited
 * for, and the answer is the same on every run.
 *
 * A value a closed node answered is not precomputed in turn, which need
 * not end; its closures capture each value once all the same.
 *
 * @type {(runtime: Runtime | undefined, steps: number) => (seen: RefMap, value: EdagValue) => readonly [RefMap, EdagValue]}
 */
export const precomputeOver = (runtime, steps) => {
    const one = closure(runtime, steps)
    return values((seen, fn) => {
        const [next, result] = once(seen, one(fn))
        return [next, /** @type {EdagValue & object} */ (result)]
    })
}

/**
 * {@link precomputeOver} no values answered before: one value on its own.
 *
 * @type {(runtime: Runtime | undefined, steps: number) => (value: EdagValue) => EdagValue}
 */
export const precompute = (runtime, steps) => {
    const over = precomputeOver(runtime, steps)
    return value => over(none, value)[1]
}
