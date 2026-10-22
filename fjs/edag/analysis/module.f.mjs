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
 * **Shared, where twins merge, is written more than once.** An entry that
 * mints identity is written once — hoisted, where more than one place
 * reaches it — and an entry that merges is written at every place that
 * reaches it, as `[cfg.a, cfg.a]` is. So an entry's count is the sum, over
 * the edges into it, of the places its parent is written: one for a parent
 * that mints identity, the parent's own count for one that merges. That
 * keeps the table the same whether a plain read was one node reached twice
 * or two nodes merged: `[r, r]` over one access node `r` of `a` and
 * `[a.x, a.x]` over two both give `a` two places.
 *
 * **Or by identity alone.** {@link identityAnalysis} merges nothing: every
 * node is its own entry, two nodes spelled alike are two entries, and the
 * shared entries are the nodes reached from more than one place — what
 * [`../sharing`](../sharing/module.f.mjs) counts for both writers, read here
 * through the table. That is the FunctionalScript writer's table, which
 * writes a shared node as one `const` and every other node where it
 * stands, so that the text keeps the sharing the graph has and adds none
 * (but for a pure node no one block holds, which it writes in each block);
 * and the one the compiler evaluates a module and every invoked body by
 * ([`../memo`](../memo/module.f.mjs)), so that a function value holds its
 * body as the graph has it, and its text is the writer's.
 *
 * **Sharing decides how many times, never when.** An edge from a lazy
 * position — an arm of `?:` or a guarded-chain operand — counts
 * as an edge, since the table records sharing and the executor decides when.
 *
 * **Refused.** A node reached from two scopes, which the compiler never
 * emits and the EDAG's scope rule forbids, returns an error rather than
 * exposing a table an executor could not honor. Noncanonical function
 * lengths are also errors. Input must be shape-checked FJS data; immutable
 * FunctionalScript construction guarantees that its value graph is acyclic.
 *
 * The accumulators are immutable and copied per node, so a build is
 * quadratic in the node count — the sizes compiled today, not a design
 * bound; the DataJS serializer's finished list and one `Map` at the end is
 * the shape to move to if it ever matters.
 *
 * @module
 *
 * @import { Arg, Exp, ExpOp, Frame, Index, Items, ItemsOver, Op0, Op1, Op2, Op3, Op12, Primitive, Properties, StepOver, TagMap } from '../types.ts'
 * @import { OptionLambda, OptionPropertyLambda, PropertyLambda } from '../types.ts'
 * @import { Analysis, IndexOperand, ItemOperand, Node, Operand, PropertyOperand, Ref, Step } from './types.ts'
 * @import { _Entry, _Handlers, _Scope, _State, _Walk } from './private.ts'
 * @import { Result } from '../../types/result/types.ts'
 */

import { assertNotNullish } from '../../asserts/module.f.js'
import { isIndex, maxLength } from '../../types/function/length/module.f.mjs'
import { mapSet } from '../../types/map/module.f.mjs'
import { error, ok } from '../../types/result/module.f.js'
import { isIntrinsic, isStatic, mapItems, mapSteps, stepOperands as edagStepOperands } from '../module.f.mjs'
import { sharedNodesOf } from '../sharing/module.f.mjs'

/** A walk that has added nothing, and merges twins where `merges` says. @type {(merges: boolean) => _State} */
const start = merges => ({ visited: new Map(), entries: [], problem: null, merges })

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
 * continues may call. Written twice, a node that does not is two values,
 * and one that does is one value computed twice.
 *
 * @type {(node: Node) => boolean}
 */
export const mergeable = node => {
    if (isIntrinsic(node)) { return false }
    switch (node[0]) {
        case '[]': case '{}': case '=>': case 'entry': case 'hasEntry': case '()': case '?.()': { return false }
        case '.': case '?.': { return node.length === 3 }
        default: { return true }
    }
}

/** @type {(scope: _Scope, node: Node) => (entry: _Entry) => boolean} */
const twin = (scope, node) => entry => entry.scope === scope && same(entry.node, node)

/**
 * The node's entry: its twin's, where the walk merges and it has one, or a
 * new one after every entry so far — after its operands, which the walk
 * added first.
 *
 * @type {(merges: boolean, scope: _Scope, node: Node) => (entries: readonly _Entry[]) => readonly [readonly _Entry[], number]}
 */
const entry = (merges, scope, node) => entries => {
    const found = merges && mergeable(node) ? entries.findIndex(twin(scope, node)) : -1
    return found === -1 ? [[...entries, { scope, node }], entries.length] : [entries, found]
}

/**
 * The operands in order, the state threaded through each.
 *
 * @template T, R
 * @param {(state: _State, x: T) => readonly [_State, R]} f
 * @returns {(state: _State, xs: readonly T[]) => readonly [_State, readonly R[]]}
 */
const each = f => (state, xs) => {
    /** @type {readonly R[]} */
    let results = []
    for (const x of xs) {
        const [next, value] = f(state, x)
        state = next
        results = [...results, value]
    }
    return [state, results]
}

/**
 * A node's entry. A node already in the table is its entry, and must be
 * reached from the scope it was added in; otherwise its operands are
 * walked, then it is added or merged.
 *
 * Primitives stand unchanged. Generic over the tag so the handler and node
 * keep their tuple correlation without another dispatch frame.
 * @type {<K extends ExpOp[0]>(scope: _Scope) => (
 *  state: _State,
 *  e: Primitive | (TagMap[K] & readonly [K, ...readonly unknown[]]),
 * ) => readonly [_State, Operand]}
 */
const walk = scope => (state, e) => {
    if (!(e instanceof Array)) { return [state, e] }
    const known = state.visited.get(e)
    if (known === undefined) {
        const [walked, n] = handlers[e[0]](scope)(state, e)
        const [entries, i] = entry(walked.merges, scope, n)(walked.entries)
        return [{ ...walked, entries, visited: mapSet(walked.visited, e, i) }, ref(i)]
    }
    const checked = state.entries[known].scope === scope ? state : {
        ...state, problem: state.problem ?? 'a node shared across a function boundary',
    }
    return [checked, ref(known)]
}

/** A naming operand: a string or a number stands, a `Number` node is walked. @type {_Walk<Index, IndexOperand>} */
const index = scope => (state, i) => /** @type {readonly [_State, IndexOperand]} */ (walk(scope)(state, i))

/** Array items in order, retaining a spread around its walked operand. @type {_Walk<readonly Items[], readonly ItemOperand[]>} */
const items = scope => (state, xs) => {
    /** @type {readonly ItemOperand[]} */
    let result = []
    for (const x of xs) {
        const spread = x instanceof Array && x[0] === '...'
        const [next, value] = walk(scope)(state, spread ? x[1] : x)
        state = next
        result = [...result, spread ? ['...', value] : value]
    }
    return [state, result]
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
            const [t, x] = items(scope)(state, k[1])
            return [t, ['|!()', x]]
        }
        default: {
            const [tag, e, cont] = k
            const [t, x] = items(scope)(state, e)
            if (cont === undefined) { return [t, [tag, x]] }
            const [u, c] = step(scope)(t, cont)
            return [u, [tag, x, c]]
        }
    }
}

/** An operation with no operands is its own entry. @type {_Walk<Op0, Node>} */
const o0 = () => (state, e) => [state, e]

/** A leaf with metadata — a binding read's index — and no operand: its own entry. @type {_Walk<Arg | Frame, Node>} */
const indexed = () => (state, e) => [state, e]

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
    self: o0,
    entry: o0,
    hasEntry: o0,
    // the intrinsics, a row each, as the static functions below
    slice: o0,
    charCodeAt: o0,
    // the static functions, a row each, so a new one is a `tsc` error here
    // until it has its row
    'Object.is': o0,
    'Object.entries': o0,
    'Number.isInteger': o0,
    'Number.isSafeInteger': o0,
    'Number.isNaN': o0,
    'Number.isFinite': o0,
    arg: indexed,
    frame: indexed,
    '!': o1,
    '~': o1,
    String: o1,
    Number: o1,
    typeof: o1,
    throw: o1,
    '+': o12,
    '-': o12,
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
    '?:': o3,
    // One operand and a constructor name: the name is metadata, carried
    // across as `arg`'s index is, never walked.
    instanceof: scope => (state, [tag, a, c]) => {
        const [t, x] = walk(scope)(state, a)
        return [t, [tag, x, c]]
    },
    // The slots are walked in the enclosing scope; the body is the scope
    // this node opens, so its entries name this node as their scope and
    // come before it, as operands come before the node that holds them.
    '=>': scope => (state, e) => {
        const [, length, slots, body] = e
        const checked = isIndex(length) ? state : {
            ...state, problem: state.problem ?? 'invalid function length',
        }
        const [t, f] = each(walk(scope))(checked, slots)
        const [u, b] = walk(e)(t, body)
        return [u, ['=>', length, f, b]]
    },
    ',': scope => (state, [, xs]) => {
        const [t, ops] = each(walk(scope))(state, xs)
        return [t, [',', ops]]
    },
    '[]': scope => (state, [, xs]) => {
        const [t, values] = items(scope)(state, xs)
        return [t, ['[]', values]]
    },
    '{}': scope => (state, [, ps]) => {
        const [t, properties] = each(property(scope))(state, ps)
        return [t, ['{}', properties]]
    },
    '()': scope => (state, [, a, b]) => {
        const [t, f] = walk(scope)(state, a)
        const [u, args] = items(scope)(t, b)
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
        const [u, args] = items(scope)(t, b)
        if (p === undefined) { return [u, ['?.()', f, args]] }
        const [v, k] = step(scope)(u, p)
        return [v, ['?.()', f, args, k]]
    },
}

/** The entries an operand names: one, or none for a primitive. @type {(x: Operand) => readonly number[]} */
const named = x => x instanceof Array ? [x[1]] : []

/** The operands of a chain's steps, including guarded arguments and computed keys. @type {(k: Step | undefined) => readonly Operand[]} */
export const stepOperands = edagStepOperands(
    /** @type {(k: IndexOperand) => readonly Operand[]} */ (k => [k]),
    /** @type {(xs: ItemsOver<Operand>) => readonly Operand[]} */ (xs => xs.map(itemOperand)))

/** A plain item or the operand of a spread. @type {(x: ItemOperand) => Operand} */
export const itemOperand = x => x instanceof Array && x[0] === '...' ? x[1] : x

/** A property's key and value, or a spread's operand. @type {(p: PropertyOperand) => readonly Operand[]} */
const propertyOperands = p => p[0] === ':' ? [p[1], p[2]] : [p[1]]

/**
 * Every operand in written order, including primitives and lazy positions.
 * Repeated occurrences remain repeated, and references retain their identity.
 * Spreads, properties and chain steps expose their operands; tags and metadata
 * are excluded. A function lists its captures followed by its body, so callers
 * that walk only the enclosing scope must handle that boundary themselves.
 *
 * @type {(node: Node) => readonly Operand[]}
 */
export const operandsOf = node => {
    // a static function and an intrinsic, as `entry`, are functions of
    // their parameters alone
    if (isStatic(node) || isIntrinsic(node)) { return [] }
    switch (node[0]) {
        case 'undefined': case 'args': case 'frame': case 'rest': case 'arg': case 'self': case 'entry': case 'hasEntry': { return [] }
        case '[]': { return node[1].map(itemOperand) }
        case '{}': { return node[1].flatMap(propertyOperands) }
        case ',': { return node[1] }
        case '=>': { return [...node[2], node[3]] }
        case '.': case '?.': {
            const [, a, b, k] = node
            return [a, b, ...stepOperands(k)]
        }
        case '()': { return [node[1], ...node[2].map(itemOperand)] }
        case '?.()': {
            const [, a, b, k] = node
            return [a, ...b.map(itemOperand), ...stepOperands(k)]
        }
        // the constructor name is metadata, not an operand — and a string,
        // which the default arm below would list as a literal operand
        case 'instanceof': { return [node[1]] }
        default: {
            const [, ...operands] = node
            return operands
        }
    }
}

/** One referenced entry per edge; primitive operands name no entry. @type {(node: Node) => readonly number[]} */
const refs = node => operandsOf(node).flatMap(named)

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
 * The entries reached from more than one place, by node identity: every
 * node `sharedNodesOf` lists in a scope — the module's, and each function
 * body's, since a walk over one scope stops at a body — by the entry it is,
 * in index order, which is the order the walk added them in. Only a walk
 * that merges nothing has an entry per node to give.
 *
 * @type {(e: Exp, visited: _State['visited']) => readonly number[]}
 */
const sharedByIdentity = (e, visited) => {
    const shared = [e, ...[...visited.keys()].flatMap(n => n[0] === '=>' ? [n[3]] : [])].flatMap(sharedNodesOf)
    return [...visited].flatMap(([n, i]) => shared.includes(n) ? [i] : [])
}

/** One operand as an expression, from the expressions of the entries before it. @type {(exps: readonly ExpOp[], operand: Operand) => Exp} */
const restore = (exps, operand) => operand instanceof Array ? exps[operand[1]] : operand

/** @type {(exps: readonly ExpOp[], items: readonly ItemOperand[]) => ItemsOver<Exp>} */
const restoreItems = (exps, items) => mapItems(/** @type {(x: Operand) => Exp} */ (x => restore(exps, x)))(items)

/** @type {(exps: readonly ExpOp[], step: Step) => StepOver<Exp>} */
const restoreStep = (exps, step) => mapSteps(
    /** @type {(x: IndexOperand) => Exp} */ (x => restore(exps, x)),
    /** @type {(items: ItemsOver<Operand>) => ItemsOver<Exp>} */ (items => restoreItems(exps, items)))(step)

/**
 * An entry as an expression, from the expressions of the entries before it,
 * which its operands are: the table's sharing restored, an operand named by
 * one index one node.
 *
 * @type {(exps: readonly ExpOp[], node: Node) => ExpOp}
 */
const restoreNode = (exps, node) => {
    switch (node[0]) {
        case '[]': { return ['[]', restoreItems(exps, node[1])] }
        case '{}': { return ['{}', node[1].map(p => p[0] === '...'
            ? ['...', restore(exps, p[1])]
            : [':', restore(exps, p[1]), restore(exps, p[2])])] }
        case '=>': { return ['=>', node[1], node[2].map(x => restore(exps, x)), restore(exps, node[3])] }
        case ',': { return [',', node[1].map(x => restore(exps, x))] }
        case '()': { return ['()', restore(exps, node[1]), restoreItems(exps, node[2])] }
        case '?.()': {
            const [, callee, args, continuation] = node
            const head = /** @type {const} */ (['?.()', restore(exps, callee), restoreItems(exps, args)])
            return /** @type {ExpOp} */ (continuation === undefined ? head : [...head, restoreStep(exps, continuation)])
        }
        case '.': case '?.': {
            const [tag, receiver, key, continuation] = node
            const head = /** @type {const} */ ([tag, restore(exps, receiver), restore(exps, key)])
            return /** @type {ExpOp} */ (continuation === undefined ? head : [...head, restoreStep(exps, continuation)])
        }
        default: {
            // All remaining tuples contain only metadata, primitives and
            // operand references, with no lists or continuation productions.
            return /** @type {ExpOp} */ (/** @type {unknown} */ (node.map(part => part instanceof Array ? restore(exps, part) : part)))
        }
    }
}

/**
 * The expression each entry stands for. Where nothing merged, an entry is
 * one node the walk was handed, and the walk added each to `visited` as it
 * added its entry, so the keys are the entries' nodes in index order. Where
 * entries merged, one entry stands for several nodes, and its expression is
 * restored from the table, once.
 *
 * @type {(merges: boolean, nodes: readonly Node[], visited: _State['visited']) => readonly ExpOp[]}
 */
const expsOf = (merges, nodes, visited) => merges
    ? nodes.reduce((/** @type {readonly ExpOp[]} */ prefix, node) => [...prefix, restoreNode(prefix, node)], [])
    : [...visited.keys()]

/**
 * The table of `e`, its twins merged where `merges` says, and its shared
 * entries counted as the table writes them: by places, where twins merge,
 * and by identity, where nothing does.
 *
 * @type {(merges: boolean) => (e: Exp) => Result<Analysis, string>}
 */
const table = merges => e => {
    const [{ visited, entries, problem }, root] = walk(null)(start(merges), e)
    if (problem !== null) { return error(problem) }
    const nodes = entries.map(x => x.node)
    return ok({
        root,
        nodes,
        scope: entries.map(x => x.scope === null ? -1 : assertNotNullish(visited.get(x.scope))),
        shared: merges ? places(root, nodes).flatMap((n, i) => n > 1 ? [i] : []) : sharedByIdentity(e, visited),
        exps: expsOf(merges, nodes, visited),
    })
}

/**
 * The table of a program: its root, its operation nodes in walk order with
 * their scopes, and the shared ones — written at more than one place.
 * `export default 1;` is an empty table with the root `1`.
 *
 * Structural failures return the first diagnostic instead of a partial table.
 * Binding checks remain separate for consumers of complete executable graphs.
 * Requires shape-checked FJS data.
 *
 * @type {(e: Exp) => Result<Analysis, string>}
 */
export const analysis = table(true)

/**
 * The same table by node identity: no twin merged, every node its own
 * entry, and `shared` the nodes reached from more than one place, as
 * `../sharing`'s `sharedNodesOf` counts them in each scope. Two programs
 * that differ only in whether an equal node is one or two — `x + x` over
 * one `const x = a + a`, or `(a + a) + (a + a)` — are two tables here,
 * where {@link analysis} gives both one.
 *
 * @type {(e: Exp) => Result<Analysis, string>}
 */
export const identityAnalysis = table(false)

/**
 * Whether the function that is entry `i` holds a node of `kind` in its own
 * body's scope — a nested function's body is that function's own. The
 * question every writer asks of a function's `['rest']` and `['self']`.
 *
 * @type {(a: Analysis, i: number, kind: Node[0]) => boolean}
 */
export const scopeHolds = ({ nodes, scope }, i, kind) => nodes.some((n, j) => n[0] === kind && scope[j] === i)

/** Whether an entry belongs to a function or a nested body it creates. @type {(scope: readonly number[], root: number, i: number) => boolean} */
const withinScope = (scope, root, i) => {
    while (i !== root && i !== -1) { i = scope[i] }
    return i === root
}

/**
 * Validate invocation bindings after scopes have been assigned, and each
 * function's length against the language's limit. Analysis also serves
 * isolated compiler fragments, so executable consumers use {@link checked}
 * once on the complete graph. Frames keep their enclosing scope: a slot read
 * names the frame of the function whose body holds it, and a module has none.
 * An optional function entry limits checks to that function and the body
 * scopes it creates. Its captures belong to the enclosing scope and are
 * excluded, including captured functions' bodies. The index must name a
 * `=>` entry in a table returned by analysis; omitted, checks cover the
 * complete graph.
 * @type {(a: Analysis, root?: number) => string | null}
 */
const bindingError = ({ nodes, scope }, root = -1) => {
    for (const [i, node] of nodes.entries()) {
        if (root !== -1 && !withinScope(scope, root, i)) { continue }
        const owner = scope[i] === -1 ? null : nodes[scope[i]]
        if (node[0] === 'args' && owner !== null) { return 'module args in a function' }
        if (node[0] === 'rest' && owner === null) { return 'the arguments outside a function' }
        if (node[0] === 'self' && owner === null) { return 'self outside a function' }
        if (node[0] === '=>' && node[1] > maxLength) { return `a function length above ${maxLength}` }
        if (node[0] === 'arg') {
            if (owner === null || owner[0] !== '=>' || !isIndex(node[1]) || node[1] >= owner[1]) {
                return 'invalid fixed parameter index or scope'
            }
        }
        if (node[0] === 'frame') {
            if (owner === null || owner[0] !== '=>' || !isIndex(node[1]) || node[1] >= owner[2].length) {
                return 'invalid frame slot index or scope'
            }
        }
    }
    return null
}

/**
 * The same analysis on binding success, or {@link bindingError}'s diagnostic. `root`
 * has {@link bindingError}'s selected-function scope; omitted, the complete
 * graph is checked. Compose with `analysis` at executable admission boundaries.
 *
 * @type {(a: Analysis, root?: number) => Result<Analysis, string>}
 */
export const checked = (a, root) => {
    const problem = bindingError(a, root)
    return problem === null ? ok(a) : error(problem)
}
