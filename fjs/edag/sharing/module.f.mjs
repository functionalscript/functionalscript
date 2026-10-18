/**
 * Sharing by node identity: which nodes an EDAG reaches from more than one
 * place. Sharing is the EDAG's own word — one node object referenced from
 * several places, as a `const` read twice lowers to — so it is a question of
 * identity, never of spelling: two nodes spelled alike are two nodes.
 *
 * Both writers count it here. The Rust printer, in
 * [`../rust/module.f.mjs`](../rust/module.f.mjs), counts with {@link visit},
 * stopping at the nodes its caller has bound, and binds every node it
 * finds reached from two places in a `let`; the FunctionalScript writer,
 * in
 * [`../../compiler/serializer/module.f.mjs`](../../compiler/serializer/module.f.mjs),
 * gives each node {@link sharedNodesOf} lists a `const`, reading the list
 * through the identity table of
 * [`../analysis/module.f.mjs`](../analysis/module.f.mjs). What each writer
 * names beyond the shared nodes is its own: the Rust printer binds an
 * unshared operation too, where the FunctionalScript writer writes it in
 * place, and the FunctionalScript writer reads a shared parameter, rest
 * array or frame slot by its name, and writes a pure node two lazy operands
 * reach with no eager path in each.
 *
 * Whether more of the two writers' walks can share this one is
 * [`../todo/identity-shared-walks.md`](../todo/identity-shared-walks.md).
 *
 * @module
 *
 * @import { Exp } from '../types.ts'
 */

import { lazyOp2Id } from '../module.f.mjs'

/**
 * The operations that establish every operand after the first only
 * conditionally: `&&`, `||` and `??` establish the right operand only if the
 * left decides nothing, and `?:` establishes the one arm its condition
 * selects — the EDAG's positional laziness, as `op2Id` and `op3Id` in
 * [`../module.f.mjs`](../module.f.mjs) state it. The binary three are
 * `lazyOp2Id` from there rather than a copy, so a writer cannot defer a
 * different set from the one the executor defers. In each the deciding
 * operand comes first and every later one is lazy.
 *
 * The chain nodes have lazy positions of their own, {@link chainLazy}: a
 * `?.` or `?.()` node's key or arguments and its continuation's operands
 * are inside the region the node opens, and a `.` node's continuation is a
 * call whose arguments a throw at the access leaves untouched. They are
 * not in this list because their eager positions are not the first operand
 * alone — a `.` node's receiver *and* key are eager — so
 * {@link eagerOperandsOf} states each tag's rule.
 *
 * @type {readonly string[]}
 */
export const lazy = [...lazyOp2Id, '?:']

/**
 * `true` for the tag of a node that opens a chain: `.`, `?.` and `?.()`,
 * the three whose last operand may be a continuation (`fjs/edag/README.md`,
 * Chains).
 *
 * @type {(id: unknown) => boolean}
 */
export const isChain = id => id === '.' || id === '?.' || id === '?.()'

/**
 * `true` for a member of a literal rather than a value: a property,
 * `[':', key, value]`, or a spread, `['...', exp]`.
 *
 * @type {(e: unknown) => boolean}
 */
const isMember = e => e instanceof Array && [':', '...'].includes(e[0])

/**
 * An item list read as the operands it holds: each member's own, in its
 * place — a spread's operand, a property's key and value — and every other
 * item as itself. A member is no node: one pair object may stand in a
 * list twice, `[s, s]`, and its operand is then reached twice, so a walk
 * counts it per occurrence, as a writer writes it.
 *
 * @type {(list: readonly unknown[]) => readonly unknown[]}
 */
export const members = list => list.flatMap(x => isMember(x) ? /** @type {readonly unknown[]} */ (x).slice(1) : [x])

/**
 * `visited` with `root`'s subgraph folded in: every distinct node it reaches
 * — root included — paired with how many places have reached it, visiting a
 * node's own children only the first time that node is met, so a heavily
 * shared graph costs its node count and not the exponential a naive walk
 * would pay; a node met again only has its count bumped. The result lists a
 * node's dependencies before the node itself — full post-order — since a
 * node is only ever appended after the fold over its children returns,
 * which is exactly the order a `let`-binding printer needs: a shared node's
 * own initializer may reference an earlier shared node, and it must already
 * be bound by then.
 *
 * No step here mutates `visited` or anything reached from it — a lookup is
 * `Array#findIndex` and a bump rebuilds the list with `Array#map`, both
 * ordinary expressions over immutable arrays.
 *
 * `operands` says which of a node's items the walk descends into: a
 * scope's own, {@link operandsOf}, or more, as a caller asks. The Rust
 * printer asks every question of a graph of this one walk — sharing, an
 * `args` read, a function held — since a walk with no memo of the nodes it
 * has met pays that exponential.
 *
 * @type {(operands: (node: readonly unknown[]) => readonly unknown[]) => (visited: readonly (readonly [node: Exp, count: number])[]) => (root: unknown) => readonly (readonly [node: Exp, count: number])[]}
 */
export const visit = operands => visited => root => {
    if (!(root instanceof Array)) { return visited }
    const self = /** @type {unknown} */ (root)
    const i = visited.findIndex(([n]) => n === self)
    if (i !== -1) {
        return visited.map((v, j) => j === i ? /** @type {readonly [Exp, number]} */ ([v[0], v[1] + 1]) : v)
    }
    const withChildren = operands(root).reduce((/** @type {readonly (readonly [Exp, number])[]} */ v, child) => visit(operands)(v)(child), visited)
    return [...withChildren, /** @type {readonly [Exp, number]} */ ([/** @type {Exp} */ (self), 1])]
}

/**
 * The operands a walk descends into, read from a node's shape rather than
 * from every array it holds: an array, object, or comma node holds its
 * operands in a list, whose first item may be a string that spells a tag —
 * `['&&', c, c]` is three array items where `['&&', c, c]` a node is an
 * operation — so the list is read as a list, and every other node's
 * operands follow its tag. A spread and a property are members of a
 * list, not nodes, so a list is read through them, {@link members}.
 *
 * A `=>` node's slots are its operands, its body is not: the body is a
 * scope of its own, established when the function is called and not when
 * it is made, and shares no node with the scope around it — so a walk over
 * one scope stops at the function boundary, and a writer walks the body
 * afresh as its own root.
 *
 * @type {(node: readonly unknown[]) => readonly unknown[]}
 */
export const operandsOf = node => {
    const [id] = node
    return id === '=>' ? /** @type {readonly unknown[]} */ (node[2])
        : id === 'arg' || id === 'entry' || id === 'hasEntry' ? []
        // the constructor name is metadata, not a string-literal operand
        : id === 'instanceof' ? [node[1]]
        : id === ',' ? /** @type {readonly unknown[]} */ (node[1])
        : id === '[]' || id === '{}' ? members(/** @type {readonly unknown[]} */ (node[1]))
        : id === '()' ? [node[1], ...members(/** @type {readonly unknown[]} */ (node[2]))]
        : isChain(id) ? [...eagerOperandsOf(node), ...chainLazy(one, items)(node)]
        : node.slice(1)
}

/**
 * What a continuation `k` holds, the step's own key or arguments, then its
 * continuation's, and nothing where there is none: `key` reads a `|.`
 * step's key and `args` a call step's item list. A continuation is not a
 * node: it is a lambda over the chain's current value
 * (`fjs/edag/README.md`, Chains), so a walk never lists it, only what it
 * holds, every item of which is inside the chain and so lazy.
 *
 * @type {(key: (x: unknown) => readonly unknown[], args: (x: unknown) => readonly unknown[]) => (k: unknown) => readonly unknown[]}
 */
const stepOperands = (key, args) => k => {
    if (k === undefined) { return [] }
    const [step, x, next] = /** @type {readonly any[]} */ (k)
    return [...(step === '|.' ? key(x) : args(x)), ...stepOperands(key, args)(next)]
}

/**
 * What a chain node holds in its lazy positions, each key read by `key`
 * and each argument list by `args`: a `?.` or `?.()` node's key or
 * arguments, inside the region its guard opens, and its continuation's,
 * {@link stepOperands}; a `.` node's continuation's, after an access that
 * may throw with them untouched; none for any other node.
 *
 * @type {(key: (x: unknown) => readonly unknown[], args: (x: unknown) => readonly unknown[]) => (node: readonly unknown[]) => readonly unknown[]}
 */
export const chainLazy = (key, args) => node => {
    const [id, , b, k] = node
    return id === '.' ? stepOperands(key, args)(k)
        : id === '?.' ? [...key(b), ...stepOperands(key, args)(k)]
        : id === '?.()' ? [...args(b), ...stepOperands(key, args)(k)]
        : []
}

/** A position read as one operand. @type {(x: unknown) => readonly unknown[]} */
export const one = x => [x]

/** An item list read as its items, an argument list's walk. @type {(x: unknown) => readonly unknown[]} */
const items = x => members(/** @type {readonly unknown[]} */ (x))

/**
 * The operands a node establishes unconditionally: a lazy operation's
 * first, a `.` node's receiver and key, a `?.` or `?.()` node's receiver
 * or callee alone — the guard decides whether anything after it runs — and
 * every operand of any other node.
 *
 * @type {(node: readonly unknown[]) => readonly unknown[]}
 */
export const eagerOperandsOf = node => {
    const [id] = node
    return lazy.includes(/** @type {string} */ (id)) ? [node[1]]
        : id === '.' ? [node[1], node[2]]
        : id === '?.' || id === '?.()' ? [node[1]]
        : operandsOf(node)
}

/**
 * The distinct nodes an EDAG reaches from more than one place, in dependency
 * order — the generalization of a corpus's explicit, named `data.shared` to
 * a linked EDAG, where sharing is implicit: two references to one `const`
 * are the same `Exp` object by identity (see `fjs/compiler/edag/module.f.mjs`'s
 * `lower`), never restated as data. Two nodes spelled alike are two nodes,
 * each reached from its own place.
 *
 * `root` itself is never "shared" by this count — nothing outside the graph
 * points at it, and the graph is acyclic, so it cannot reach itself — which
 * is why it never needs a binding of its own; a caller writes it as the
 * scope's final, unbound expression.
 *
 * @type {(root: Exp) => readonly Exp[]}
 */
export const sharedNodesOf = root => visit(operandsOf)([])(root)
    .filter(([, count]) => count >= 2)
    .map(([node]) => node)
