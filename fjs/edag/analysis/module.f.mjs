/**
 * The EDAG analysis: one table for a writer and a VM.
 *
 * Two consumers of an EDAG have to know which nodes are shared without
 * running it, and neither can ask the graph directly, since sharing is node
 * identity and a walk sees identity only with a memo of its own. `analysis`
 * reads a graph once and returns what both need, in a form that needs no
 * identity-keyed structure downstream: every operation node once, in walk
 * order, naming its operands by index; the scope each node belongs to; and
 * the indices reached by more than one edge, which a writer hoists and an
 * executor caches. See `Analysis` in [`types.ts`](./types.ts) and
 * [`../execution-models.md`](../execution-models.md) §2.2.
 *
 * **Merged before counted, within one scope.** A node whose result identity
 * is decided by its inputs — a plain read, an operator, the comma — is the
 * same entry as another in the same scope spelled the same over the same
 * inputs, so `[cfg.a, cfg.a]` is one entry reached twice. Inputs are the
 * same when each operand is: an entry by its index, a primitive by
 * `Object.is`, so `0` and `-0` are different inputs and `NaN` is the same
 * as `NaN`. A constructor — `[]`, `{}`, `=>` — mints identity and is never
 * merged, two `[]` being two arrays; nor is a call in any spelling — `()`,
 * `?.()`, or a chain that continues, since only a call can spend the
 * receiver a continuation carries — which may mint a fresh result each
 * time. Merging unifies entries and removes no edge: the merged entry's
 * edges are the sum over its occurrences, and its operands keep every edge
 * each occurrence gave them.
 *
 * **Shared is written more than once.** An entry that mints identity is
 * written once — hoisted, where more than one place reaches it — and an
 * entry that merges is written at every place that reaches it, as
 * `[cfg.a, cfg.a]` is. So an entry's count is the sum, over the edges into
 * it, of the places its parent is written: one for a parent that mints
 * identity, the parent's own count for one that merges. That keeps the
 * table the same whether a plain read was one node reached twice or two
 * nodes merged, which is what the writer's round trip needs: `[r, r]` over
 * one access node `r` of `a` and `[a.x, a.x]` over two both give `a` two
 * places, and `a` is hoisted in both, so that it stays one array.
 *
 * **Sharing decides how many times, never when.** An edge from a lazy
 * position — the right operand of `&&`, `||`, `??`, an arm of `?:` — counts
 * as an edge, since the table records sharing and the executor decides when.
 *
 * **Refused.** A node reached from two scopes, which the compiler never
 * emits and the EDAG's scope rule forbids, throws where it is met rather
 * than filling the table with an answer an executor could not honor. A
 * cycle is not an EDAG and not a value FunctionalScript can build; on one
 * the walk overflows the stack, as `validate` does.
 *
 * The accumulators are immutable and copied per node, so a build is
 * quadratic in the node count — the sizes compiled today, not a design
 * bound; the DataJS serializer's finished list and one `Map` at the end is
 * the shape to move to if it ever matters.
 *
 * @module
 *
 * @import { Exp, ExpOp, Index, Items, Op0, Op1, Op2, Op3, Op12, Properties, TagMap } from '../types.ts'
 * @import { OptionLambda, OptionPropertyLambda, PropertyLambda } from '../types.ts'
 * @import { Analysis, IndexOperand, ItemOperand, Node, Operand, PropertyOperand, Ref, Step } from './types.ts'
 * @import { _Entry, _Handlers, _Scope, _State, _Walk } from './private.ts'
 */

import { assert, assertNotNullish } from '../../asserts/module.f.mjs'
import { isIndex, maxLength } from '../../types/function/length/module.f.mjs'
import { mapSet } from '../../types/map/module.f.mjs'

/** @type {_State} */
const start = { visited: new Map(), entries: [] }

/** @type {(i: number) => Ref} */
const ref = i => ['#', i]

/**
 * Two entries spelled the same over the same inputs: the same tuples, a
 * primitive by `Object.is` — the language's `is` — so `-0` is not `0`.
 *
 * @type {(a: unknown, b: unknown) => boolean}
 */
const same = (a, b) => a instanceof Array
    ? b instanceof Array && a.length === b.length && a.every((x, i) => same(x, b[i]))
    : Object.is(a, b)

/**
 * Whether an entry may merge with a twin: its result identity is decided by
 * its inputs. A constructor mints identity and a call may; a chain that
 * continues may call.
 *
 * @type {(node: Node) => boolean}
 */
const mergeable = node => {
    switch (node[0]) {
        case '[]': case '{}': case '=>': case '()': case '?.()': { return false }
        case '.': case '?.': { return node.length === 3 }
        default: { return true }
    }
}

/** @type {(scope: _Scope, node: Node) => (entry: _Entry) => boolean} */
const twin = (scope, node) => entry => entry.scope === scope && same(entry.node, node)

/**
 * The node's entry: its twin's, where it has one, or a new one after every
 * entry so far — after its operands, which the walk added first.
 *
 * @type {(scope: _Scope, node: Node) => (entries: readonly _Entry[]) => readonly [readonly _Entry[], number]}
 */
const entry = (scope, node) => entries => {
    const found = mergeable(node) ? entries.findIndex(twin(scope, node)) : -1
    return found === -1 ? [[...entries, { scope, node }], entries.length] : [entries, found]
}

/**
 * The operands in order, the state threaded through each.
 *
 * @template T, R
 * @param {(state: _State, x: T) => readonly [_State, R]} f
 * @returns {(state: _State, xs: readonly T[]) => readonly [_State, readonly R[]]}
 */
const each = f => (state, xs) => xs.reduce(
    /** @type {(acc: readonly [_State, readonly R[]], x: T) => readonly [_State, readonly R[]]} */
    (([s, rs], x) => {
        const [t, r] = f(s, x)
        return [t, [...rs, r]]
    }),
    /** @type {readonly [_State, readonly R[]]} */ ([state, []]),
)

/** An operand: a primitive stands, a node is walked. @type {_Walk<Exp, Operand>} */
const walk = scope => (state, e) => e instanceof Array ? node(scope)(state, e) : [state, e]

/**
 * A node's entry. A node already in the table is its entry, and must be
 * reached from the scope it was added in; otherwise its operands are
 * walked, then it is added or merged.
 *
 * @type {_Walk<ExpOp, Ref>}
 */
const node = scope => (state, e) => {
    const known = state.visited.get(e)
    const [next, i] = known === undefined ? fresh(scope)(state, e) : [state, known]
    assert(next.entries[i].scope === scope, ['a node shared across a function boundary', e])
    return [next, ref(i)]
}

/** @type {(scope: _Scope) => (state: _State, e: ExpOp) => readonly [_State, number]} */
const fresh = scope => (state, e) => {
    const [walked, n] = dispatch(scope, state, e)
    const [entries, i] = entry(scope, n)(walked.entries)
    return [{ ...walked, entries, visited: mapSet(walked.visited, e, i) }, i]
}

/**
 * Generic over the tag, so that `handlers[e[0]]` is the one signature for
 * `e`'s tuple rather than the union of all of them — see `TagMap` in
 * `../types.ts`.
 *
 * @type {<K extends ExpOp[0]>(
 *  scope: _Scope,
 *  state: _State,
 *  e: TagMap[K] & readonly [K, ...readonly unknown[]],
 * ) => readonly [_State, Node]}
 */
const dispatch = (scope, state, e) => handlers[e[0]](scope)(state, e)

/** A naming operand: a string or a number stands, a `Number` node is walked. @type {_Walk<Index, IndexOperand>} */
const index = scope => (state, i) => i instanceof Array ? node(scope)(state, i) : [state, i]

/** An array item: a spread's operand is walked, and the spread kept around it. @type {_Walk<Items, ItemOperand>} */
const item = scope => (state, x) => {
    if (!(x instanceof Array) || x[0] !== '...') { return walk(scope)(state, x) }
    const [t, a] = walk(scope)(state, x[1])
    return [t, ['...', a]]
}

/** An object entry: the key and the value, or a spread's operand. @type {_Walk<Properties, PropertyOperand>} */
const property = scope => (state, p) => {
    if (p[0] === '...') {
        const [t, a] = walk(scope)(state, p[1])
        return [t, ['...', a]]
    }
    const [t, k] = walk(scope)(state, p[1])
    const [u, v] = walk(scope)(t, p[2])
    return [u, [':', k, v]]
}

/**
 * A chain step and the steps after it. Every step is `[tag, operand,
 * continuation?]` whatever type it is, so one walk serves all three.
 *
 * @type {_Walk<PropertyLambda | OptionLambda | OptionPropertyLambda, Step>}
 */
const step = scope => (state, k) => {
    switch (k[0]) {
        case '|.': {
            const [, i, cont] = k
            const [t, x] = index(scope)(state, i)
            if (cont === undefined) { return [t, ['|.', x]] }
            const [u, c] = step(scope)(t, cont)
            return [u, ['|.', x, c]]
        }
        case '|!()': {
            const [t, x] = walk(scope)(state, k[1])
            return [t, ['|!()', x]]
        }
        default: {
            const [tag, e, cont] = k
            const [t, x] = walk(scope)(state, e)
            if (cont === undefined) { return [t, [tag, x]] }
            const [u, c] = step(scope)(t, cont)
            return [u, [tag, x, c]]
        }
    }
}

/** An operation with no operands is its own entry. @type {_Walk<Op0, Node>} */
const o0 = () => (state, e) => [state, e]

/** @type {_Walk<Op1, Node>} */
const o1 = scope => (state, [tag, a]) => {
    const [t, x] = walk(scope)(state, a)
    return [t, [tag, x]]
}

/** One tag at two arities: the node's length says which, and both operands are walked. @type {_Walk<Op12, Node>} */
const o12 = scope => (state, e) => {
    const [tag, a] = e
    const [t, x] = walk(scope)(state, a)
    if (e.length === 2) { return [t, [tag, x]] }
    const [u, y] = walk(scope)(t, e[2])
    return [u, [tag, x, y]]
}

/** Both operands, the lazy ones included: an edge is an edge. @type {_Walk<Op2, Node>} */
const o2 = scope => (state, [tag, a, b]) => {
    const [t, x] = walk(scope)(state, a)
    const [u, y] = walk(scope)(t, b)
    return [u, [tag, x, y]]
}

/** @type {_Walk<Op3, Node>} */
const o3 = scope => (state, [tag, a, b, c]) => {
    const [t, x] = walk(scope)(state, a)
    const [u, y] = walk(scope)(t, b)
    const [v, z] = walk(scope)(u, c)
    return [v, [tag, x, y, z]]
}

/** @type {_Handlers} */
const handlers = {
    undefined: o0,
    args: o0,
    rest: o0,
    arg: () => (state, e) => [state, e],
    frame: o0,
    '!': o1,
    '~': o1,
    String: o1,
    Number: o1,
    typeof: o1,
    '+': o12,
    '-': o12,
    own: o2,
    is: o2,
    '===': o2,
    '!==': o2,
    '>': o2,
    '>=': o2,
    '<': o2,
    '<=': o2,
    '*': o2,
    '/': o2,
    '%': o2,
    '**': o2,
    '&': o2,
    '|': o2,
    '^': o2,
    '<<': o2,
    '>>': o2,
    '>>>': o2,
    '&&': o2,
    '||': o2,
    '??': o2,
    '?:': o3,
    // The frame is walked in the enclosing scope; the body is the scope
    // this node opens, so its entries name this node as their scope and
    // come before it, as operands come before the node that holds them.
    '=>': scope => (state, e) => {
        const [, length, frame, body] = e
        assert(isIndex(length), ['invalid function length', length])
        const [t, f] = walk(scope)(state, frame)
        const [u, b] = walk(e)(t, body)
        return [u, ['=>', length, f, b]]
    },
    ',': scope => (state, [, xs]) => {
        const [t, ops] = each(walk(scope))(state, xs)
        return [t, [',', ops]]
    },
    '[]': scope => (state, [, xs]) => {
        const [t, items] = each(item(scope))(state, xs)
        return [t, ['[]', items]]
    },
    '{}': scope => (state, [, ps]) => {
        const [t, properties] = each(property(scope))(state, ps)
        return [t, ['{}', properties]]
    },
    '()': scope => (state, [, a, b]) => {
        const [t, f] = walk(scope)(state, a)
        const [u, args] = walk(scope)(t, b)
        return [u, ['()', f, args]]
    },
    '.': scope => (state, [, a, i, p]) => {
        const [t, base] = walk(scope)(state, a)
        const [u, key] = index(scope)(t, i)
        if (p === undefined) { return [u, ['.', base, key]] }
        const [v, k] = step(scope)(u, p)
        return [v, ['.', base, key, k]]
    },
    '?.': scope => (state, [, a, i, p]) => {
        const [t, base] = walk(scope)(state, a)
        const [u, key] = index(scope)(t, i)
        if (p === undefined) { return [u, ['?.', base, key]] }
        const [v, k] = step(scope)(u, p)
        return [v, ['?.', base, key, k]]
    },
    '?.()': scope => (state, [, a, b, p]) => {
        const [t, f] = walk(scope)(state, a)
        const [u, args] = walk(scope)(t, b)
        if (p === undefined) { return [u, ['?.()', f, args]] }
        const [v, k] = step(scope)(u, p)
        return [v, ['?.()', f, args, k]]
    },
}

/** The entries an operand names: one, or none for a primitive. @type {(x: Operand | IndexOperand) => readonly number[]} */
const named = x => x instanceof Array ? [x[1]] : []

/** @type {(k: Step | undefined) => readonly number[]} */
const stepRefs = k => {
    if (k === undefined) { return [] }
    const [, x, cont] = k
    return [...named(x), ...stepRefs(cont)]
}

/** @type {(x: ItemOperand) => readonly number[]} */
const itemRefs = x => x instanceof Array && x[0] === '...' ? named(x[1]) : named(x)

/** @type {(p: PropertyOperand) => readonly number[]} */
const propertyRefs = p => p[0] === ':' ? [...named(p[1]), ...named(p[2])] : named(p[1])

/**
 * The entries a node names, one per edge, wherever the edge stands — an
 * item, a property, a step. By kind rather than by a search for `'#'`,
 * since an item list may hold the string `'#'` and a number and be no
 * reference.
 *
 * @type {(node: Node) => readonly number[]}
 */
const refs = node => {
    switch (node[0]) {
        case 'undefined': case 'args': case 'frame': case 'rest': case 'arg': { return [] }
        case '[]': { return node[1].flatMap(itemRefs) }
        case '{}': { return node[1].flatMap(propertyRefs) }
        case ',': { return node[1].flatMap(named) }
        case '.': case '?.': case '?.()': {
            const [, a, b, k] = node
            return [...named(a), ...named(b), ...stepRefs(k)]
        }
        default: {
            const [, ...operands] = node
            return operands.flatMap(named)
        }
    }
}

/**
 * The places each entry is written, from the root down: the root once,
 * and each operand once per place its parent is written — a parent that
 * mints identity is written once, hoisted or not, and a parent that
 * merges at every place. Parents come after their operands, so the pass
 * runs from the last entry to the first, and an entry's count is complete
 * by the time its own operands are counted.
 *
 * @type {(root: Operand, nodes: readonly Node[]) => readonly number[]}
 */
const places = (root, nodes) => nodes.reduceRight(
    (counts, node, i) => {
        const weight = mergeable(node) ? counts[i] : 1
        return refs(node).reduce((c, r) => c.with(r, c[r] + weight), counts)
    },
    /** @type {readonly number[]} */ (nodes.map((_, i) => root instanceof Array && root[1] === i ? 1 : 0)),
)

/**
 * The table of a program: its root, its operation nodes in walk order with
 * their scopes, and the shared ones — written at more than one place.
 * `export default 1;` is an empty table with the root `1`.
 *
 * @type {(e: Exp) => Analysis}
 */
export const analysis = e => {
    const [{ visited, entries }, root] = walk(null)(start, e)
    const nodes = entries.map(x => x.node)
    return {
        root,
        nodes,
        scope: entries.map(x => x.scope === null ? -1 : assertNotNullish(visited.get(x.scope))),
        shared: places(root, nodes).flatMap((n, i) => n > 1 ? [i] : []),
    }
}

/**
 * Validate invocation bindings after scopes have been assigned, and each
 * function's length against the language's limit. Analysis also serves
 * isolated compiler fragments, so executable consumers call this once on the
 * complete graph. Frames keep their enclosing scope.
 * @type {(a: Analysis) => string | null}
 */
export const bindingError = ({ nodes, scope }) => {
    for (const [i, node] of nodes.entries()) {
        const owner = scope[i] === -1 ? null : nodes[scope[i]]
        if (node[0] === 'args' && owner !== null) { return 'module args in a function' }
        if (node[0] === 'rest' && owner === null) { return 'the arguments outside a function' }
        if (node[0] === '=>' && node[1] > maxLength) { return `a function length above ${maxLength}` }
        if (node[0] === 'arg') {
            if (owner === null || owner[0] !== '=>' || !isIndex(node[1]) || node[1] >= owner[1]) {
                return 'invalid fixed parameter index or scope'
            }
        }
    }
    return null
}
