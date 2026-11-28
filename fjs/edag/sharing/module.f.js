/**
 * Sharing by node identity: which nodes an EDAG reaches from more than one
 * place. Sharing is the EDAG's own word — one node object referenced from
 * several places, as a `const` read twice lowers to — so it is a question of
 * identity, never of spelling: two nodes spelled alike are two nodes.
 *
 * Identity analysis uses this walk's scope-local counts. Common graph-to-FAST
 * conversion then chooses bindings and evaluation regions once for all output
 * targets. Serializers render prepared FAST and perform no graph placement.
 *
 * @module
 *
 * @import { Exp, StepOver } from '../types.ts'
 * @import { PersistentMap } from '../../types/map/types.ts'
 */

import { isHelper, stepOperands } from '../module.f.js'
import { empty, mapEntries, mapGet, mapSet } from '../../types/map/module.f.js'

/**
 * The conditional establishes its condition, then the selected arm. Source
 * logical operators have already become conditionals; every op2 is eager.
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
export const lazy = ['?:']

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
 * Every distinct node `root` reaches — root included — paired with how many
 * places have reached it, visiting a node's own children only the first
 * time that node is met, so a heavily shared graph costs its node count and
 * not the exponential a naive walk would pay; a node met again only has its
 * count bumped. The result lists a node's dependencies before the node
 * itself — full post-order — since a node is only ever added after the fold
 * over its children returns, which is exactly the order a `let`-binding
 * printer needs: a shared node's own initializer may reference an earlier
 * shared node, and it must already be bound by then.
 *
 * The nodes met are held by identity in the shared persistent map, which
 * keeps a key where it was first added: meeting a node is a lookup, and a
 * bump copies a search path and not the list.
 *
 * `operands` says which of a node's items the walk descends into: a
 * scope's own, {@link operandsOf}, or more, as a caller asks. The Rust
 * printer asks every question of a graph of this one walk — sharing, an
 * `args` read, a function held — since a walk with no memo of the nodes it
 * has met pays that exponential.
 *
 * @type {(operands: (node: readonly unknown[]) => readonly unknown[]) => (root: unknown) => readonly (readonly [node: Exp, count: number])[]}
 */
export const visit = operands => {
    /** @type {(visited: PersistentMap<Exp, number>, root: unknown) => PersistentMap<Exp, number>} */
    const met = (visited, root) => {
        if (!(root instanceof Array)) { return visited }
        const self = /** @type {Exp} */ (/** @type {unknown} */ (root))
        const count = mapGet(visited, self)
        return count !== undefined ? mapSet(visited, self, count + 1) : mapSet(operands(root).reduce(met, visited), self, 1)
    }
    return root => mapEntries(met(empty, root))
}

/**
 * Ordinary nodes hold their operands after the tag or in one item list.
 * Chain nodes are handled separately so full and eager walks share this
 * selection without referring to each other.
 * @type {(node: readonly unknown[]) => readonly unknown[]}
 */
const ordinaryOperandsOf = node => {
    const [id] = node
    return id === 'group' ? /** @type {readonly unknown[]} */ (node[1])
        : id === 'fn' ? [node[1]]
        : id === 'self' ? []
        : id === '=>' ? /** @type {readonly unknown[]} */ (node[2])
        : id === 'arg' || isHelper(node) ? []
        // the constructor name is metadata, not a string-literal operand
        : id === 'instanceof' ? [node[1]]
        // and so is the key of an entry check
        : id === 'in' ? [node[2]]
        : id === ',' ? /** @type {readonly unknown[]} */ (node[1])
        : id === '[]' || id === '{}' ? members(/** @type {readonly unknown[]} */ (node[1]))
        : id === '()' ? [node[1], ...members(/** @type {readonly unknown[]} */ (node[2]))]
        : node.slice(1)
}

/**
 * What a continuation holds, read by {@link stepOperands}: a continuation is
 * not a node but a lambda over the chain's current value
 * (`fjs/edag/README.md`, Chains), so a walk never lists it, only what it
 * holds, every item of which is inside the chain and so lazy.
 *
 * @type {(key: (x: unknown) => readonly unknown[], args: (x: unknown) => readonly unknown[]) => (k: unknown) => readonly unknown[]}
 */
const continuationOperands = (key, args) => k => stepOperands(key, args)(/** @type {StepOver<unknown, unknown> | undefined} */ (k))

/**
 * What a chain node holds in its lazy positions, each key read by `key`
 * and each argument list by `args`: a `?.` or `?.()` node's key or
 * arguments, inside the region its guard opens, and its continuation's,
 * {@link continuationOperands}; a `.` node's continuation's, after an access that
 * may throw with them untouched; none for any other node.
 *
 * @type {(key: (x: unknown) => readonly unknown[], args: (x: unknown) => readonly unknown[]) => (node: readonly unknown[]) => readonly unknown[]}
 */
export const chainLazy = (key, args) => node => {
    const [id, , b, k] = node
    return id === '.' ? continuationOperands(key, args)(k)
        : id === '?.' ? [...key(b), ...continuationOperands(key, args)(k)]
        : id === '?.()' ? [...args(b), ...continuationOperands(key, args)(k)]
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
        : ordinaryOperandsOf(node)
}

/**
 * The operands a walk descends into, read from a node's shape rather than
 * from every array it holds: an array, object, or comma node holds its
 * operands in a list, whose first item may be a string that spells a tag —
 * `['+', c, c]` is three array items where `['+', c, c]` a node is an
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
export const operandsOf = node => isChain(node[0])
    ? [...eagerOperandsOf(node), ...chainLazy(one, items)(node)]
    : ordinaryOperandsOf(node)

/**
 * A node's operands with a function's body among them: what a walk of a
 * whole graph descends into, where {@link operandsOf} stops at the function
 * boundary.
 *
 * @type {(node: readonly unknown[]) => readonly unknown[]}
 */
export const withBodies = node => node[0] === '=>' ? [...operandsOf(node), node[3]]
    : node[0] === 'group' ? [...operandsOf(node), .../** @type {readonly import('../types.ts').GroupMember[]} */ (node[2]).map(([, body]) => body)]
    : operandsOf(node)

/**
 * The distinct nodes an EDAG reaches from more than one place, in dependency
 * order — the generalization of a corpus's explicit, named `data.shared` to
 * a linked EDAG, where sharing is implicit: two references to one `const`
 * are the same `Exp` object by identity (see `fjs/compiler/edag/module.f.js`'s
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
export const sharedNodesOf = root => visit(operandsOf)(root)
    .filter(([, count]) => count >= 2)
    .map(([node]) => node)
