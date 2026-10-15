/**
 * Sharing by node identity, claim by claim: what a walk descends into, per
 * node kind, and which nodes it counts as reached from more than one place.
 *
 * @import { Exp, PropertyLambda } from '../types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { chainLazy, eagerNodesOf, eagerOperandsOf, isChain, lazy, members, one, operandsOf, sharedNodesOf, visit } from './module.f.mjs'

/** @type {Exp} */
const c = ['[]', []]

export const proof = {
    /** The lazy operations, the binary three and the conditional, and the three chain tags. */
    tags: () => {
        assertStructurallySame(lazy, ['&&', '||', '??', '?:'])
        assertEq(['.', '?.', '?.()'].every(isChain), true)
        assertEq(isChain('()'), false)
    },
    /** A member is read as its operands, a spread's or a property's; any other item as itself. */
    members: () => {
        assertStructurallySame(members([c, ['...', 1], [':', 'k', 2]]), [c, 1, 'k', 2])
    },
    /** What a walk descends into, per node kind. */
    operandsOf: () => {
        // a function's slots, not its body
        assertStructurallySame(operandsOf(['=>', 0, [c], ['arg', 0]]), [c])
        // an index is metadata, and the entry helper holds nothing
        assertStructurallySame(operandsOf(['arg', 0]), [])
        assertStructurallySame(operandsOf(['entry']), [])
        // the constructor's name is no operand
        assertStructurallySame(operandsOf(['instanceof', c, 'Array']), [c])
        // a list is read as a list, whatever its first item spells
        assertStructurallySame(operandsOf([',', ['&&', c]]), ['&&', c])
        assertStructurallySame(operandsOf(['[]', ['&&', ['...', c]]]), ['&&', c])
        assertStructurallySame(operandsOf(['{}', [[':', 'k', c]]]), ['k', c])
        assertStructurallySame(operandsOf(['()', c, [1, ['...', 2]]]), [c, 1, 2])
        // a chain's eager positions, then its lazy ones, the steps' keys
        // and arguments in order
        assertStructurallySame(operandsOf(['.', c, 'a', ['|.', 'b', ['|()', [1]]]]), [c, 'a', 'b', 1])
        assertStructurallySame(operandsOf(['?.', c, 'a', ['|?.()', [1], ['|.', 'b']]]), [c, 'a', 1, 'b'])
        assertStructurallySame(operandsOf(['?.()', c, [1]]), [c, 1])
        // and every other node's operands follow its tag
        assertStructurallySame(operandsOf(['?:', c, 1, 2]), [c, 1, 2])
    },
    /** The positions a node establishes unconditionally. */
    eagerOperandsOf: () => {
        assertStructurallySame(eagerOperandsOf(['&&', c, 1]), [c])
        assertStructurallySame(eagerOperandsOf(['?:', c, 1, 2]), [c])
        assertStructurallySame(eagerOperandsOf(['.', c, 'a', ['|()', [1]]]), [c, 'a'])
        assertStructurallySame(eagerOperandsOf(['?.', c, 'a']), [c])
        assertStructurallySame(eagerOperandsOf(['?.()', c, [1]]), [c])
        assertStructurallySame(eagerOperandsOf(['+', c, 1]), [c, 1])
    },
    /** A chain's lazy positions, each key and argument list read as the caller asks; none for any other node. */
    chainLazy: () => {
        assertStructurallySame(chainLazy(one, one)(['?.()', c, [1], ['|.', 'b']]), [[1], 'b'])
        assertStructurallySame(chainLazy(one, one)(['.', c, 'a']), [])
        assertStructurallySame(chainLazy(one, one)(['+', c, 1]), [])
    },
    /** Each distinct node once, with the places reaching it, after the nodes it reaches. */
    visit: () => {
        /** @type {Exp} */
        const root = ['[]', [c, c]]
        assertStructurallySame(visit(operandsOf)([])(root), [[c, 2], [root, 1]])
        assertStructurallySame(visit(operandsOf)([])(1), [])
    },
    /**
     * The nodes a root establishes unconditionally: through every eager
     * position, and a lazy operation's first operand, never its others —
     * however a node is also reached lazily.
     */
    eagerNodesOf: () => {
        /** @type {Exp} */
        const c = ['[]', []]
        // Through an array item, an object value, a comma operand, an eager
        // operator's operands, a `.` base, and a lazy operation's first
        // operand.
        assertEq(eagerNodesOf(['[]', [c]]).includes(c), true)
        assertEq(eagerNodesOf(['{}', [[':', 'k', c]]]).includes(c), true)
        assertEq(eagerNodesOf([',', [c, 1]]).includes(c), true)
        assertEq(eagerNodesOf(['*', 1, c]).includes(c), true)
        assertEq(eagerNodesOf(['.', c, 'length']).includes(c), true)
        assertEq(eagerNodesOf(['&&', c, 1]).includes(c), true)
        assertEq(eagerNodesOf(['?:', c, 1, 2]).includes(c), true)
        // Not through a function's body, established only when it is called.
        assertEq(eagerNodesOf(['=>', 0, [], ['[]', [c]]]).includes(c), false)
        // Not through a lazy operand, at any depth below it.
        assertEq(eagerNodesOf(['&&', true, c]).includes(c), false)
        assertEq(eagerNodesOf(['||', true, c]).includes(c), false)
        assertEq(eagerNodesOf(['??', true, c]).includes(c), false)
        assertEq(eagerNodesOf(['?:', true, c, 2]).includes(c), false)
        assertEq(eagerNodesOf(['?:', true, 1, ['[]', [c, c]]]).includes(c), false)
        // One eager reach is enough, wherever the lazy ones are.
        assertEq(eagerNodesOf(['[]', [['&&', true, c], c]]).includes(c), true)
        // A list whose first item spells a lazy tag is a list: both `c`s
        // are items, reached.
        assertEq(eagerNodesOf(['[]', ['&&', c, ['&&', true, c]]]).includes(c), true)
        // The root comes first, and a primitive root reaches nothing.
        assertStructurallySame(eagerNodesOf(c), [c])
        assertStructurallySame(eagerNodesOf(1), [])
        // and a node reached twice is listed once
        /** @type {Exp} */
        const twice = ['[]', [c, c]]
        assertStructurallySame(eagerNodesOf(twice), [twice, c])
        // The eager positions per chain tag: a `.` node's receiver and key,
        // a `?.` or `?.()` node's first operand; nothing inside a
        // continuation, at any depth, nor a `?.()` node's arguments.
        assertEq(eagerNodesOf(['.', c, 'a', ['|()', []]]).includes(c), true)
        assertEq(eagerNodesOf(['?.', c, 'a']).includes(c), true)
        assertEq(eagerNodesOf(['?.()', c, []]).includes(c), true)
        assertEq(eagerNodesOf(['.', ['{}', []], 'a', ['|()', [c]]]).includes(c), false)
        assertEq(eagerNodesOf(['?.()', ['undefined'], [c]]).includes(c), false)
        assertEq(eagerNodesOf(['?.', ['{}', []], 'a', ['|.', 'b', ['|()', [c]]]]).includes(c), false)
    },
    sharedNodesOf: {
        /** A node reached from only one place is never a binding candidate. */
        none: () => {
            assertEq(sharedNodesOf(['[]', [1, 2]]).length, 0)
        },
        /**
         * Two references to the same node, by identity, is exactly what a
         * `const` referenced twice looks like once lowered to an EDAG — see
         * `fjs/compiler/edag/module.f.mjs`'s `lower`.
         */
        shared: () => {
            /** @type {Exp} */
            const base = ['[]', []]
            /** @type {Exp} */
            const root = ['[]', [base, base]]
            const found = sharedNodesOf(root)
            assertEq(found.length, 1)
            assert(found[0] === base, found)
        },
        /**
         * Two nodes spelled alike are two nodes, each reached from its own
         * place: sharing is identity, not spelling.
         */
        twins: () => {
            assertEq(sharedNodesOf(['+', ['+', ['arg', 0], ['arg', 0]], ['+', ['arg', 0], ['arg', 0]]]).length, 0)
        },
        /**
         * Dependency order: a shared node nested inside another shared node
         * comes first, since the outer one's binding reads the inner one's.
         */
        order: () => {
            /** @type {Exp} */
            const inner = ['[]', []]
            /** @type {Exp} */
            const outer = ['[]', [inner]]
            /** @type {Exp} */
            const root = ['[]', [outer, outer, inner, inner]]
            const found = sharedNodesOf(root)
            assertEq(found.length, 2)
            assert(found[0] === inner, found)
            assert(found[1] === outer, found)
        },
        /** The root itself is never reported, however the graph is shaped. */
        excludesRoot: () => {
            /** @type {Exp} */
            const root = ['[]', [1]]
            assert(!sharedNodesOf(root).includes(root), sharedNodesOf(root))
        },
        /**
         * A function's body is a scope of its own: nothing inside it is
         * shared at the scope around it — a writer walks the body afresh
         * — while its frame is that scope's.
         */
        stopsAtAFunctionBody: () => {
            /** @type {Exp} */
            const x = ['[]', []]
            assertEq(sharedNodesOf(['=>', 0, [], ['[]', [x, x]]]).length, 0)
            const found = sharedNodesOf(['[]', [['=>', 0, [x], 1], x]])
            assertEq(found.length, 1)
            assert(found[0] === x, found)
        },
        /**
         * A continuation is not a node: the walk lists what it holds and
         * never the tuple itself, so a continuation two chains hold reaches
         * what it holds twice.
         */
        continuation: () => {
            /** @type {PropertyLambda} */
            const k = ['|()', [c]]
            assertEq(sharedNodesOf(['[]', [['.', ['{}', []], 'a', k], ['.', ['{}', []], 'b', k]]]).includes(c), true)
        },
        /**
         * A sharing chain forty levels deep, each level reaching the one
         * before it twice, is counted as fast as its forty nodes and not
         * as the trillion paths through them.
         */
        walksSharedNodesOnce: () => {
            /** @type {(depth: number, node: Exp) => Exp} */
            const chain = (depth, node) => depth === 0 ? node : chain(depth - 1, ['[]', [node, node]])
            assertEq(sharedNodesOf(chain(40, ['[]', []])).length, 40)
        },
    },
}
