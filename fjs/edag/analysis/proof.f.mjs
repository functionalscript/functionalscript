/**
 * The table `analysis` builds — one section per claim the module makes:
 * numbering and walk order, what merges and what does not, scopes, edges
 * from lazy positions, the node kinds, and the refusal.
 *
 * @import { Exp } from '../types.ts'
 * @import { Analysis, Node } from './types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { analysis } from './module.f.mjs'

/**
 * What every table satisfies, checked on every case: an entry names only
 * entries before it, since a node comes after its operands; a scope is the
 * module's or a `=>` after the entry, since a `=>` comes after its body; and
 * `shared` is in index order.
 *
 * @type {(a: Analysis) => Analysis}
 */
const sound = a => {
    const { nodes, scope, shared } = a
    assertEq(scope.length, nodes.length)
    nodes.forEach((node, i) => {
        refs(node).forEach(r => { assert(r < i, ['an operand after its node', i, r]) })
        assert(scope[i] === -1 || (scope[i] > i && nodes[scope[i]][0] === '=>'), ['a scope that is not a later =>', i])
    })
    shared.forEach((s, n) => { assert(n === 0 || shared[n - 1] < s, ['shared out of order', shared]) })
    return a
}

/**
 * Every index an entry names, wherever it stands. A `Ref` is `['#', i]`
 * and a table holds nothing else tagged `'#'` — the string `'#'` as a
 * primitive operand is not an array — so the collection can be structural,
 * where the module's own edge count is not.
 *
 * @type {(x: unknown) => readonly number[]}
 */
const refs = x => !(x instanceof Array) ? []
    : x[0] === '#' && typeof x[1] === 'number' ? [x[1]]
    : x.flatMap(refs)

/** @type {(e: Exp) => Analysis} */
const an = e => sound(analysis(e))

/** @type {(e: Exp, expected: Analysis) => void} */
const table = (e, expected) => { assertStructurallySame(an(e), expected) }

/** The nodes of a table, when that is all a case is about. @type {(e: Exp) => readonly Node[]} */
const nodesOf = e => an(e).nodes

/** `[]`, a constructor. @type {Exp} */
const empty = ['[]', []]

/** `(...a) => a[0]`, no frame. @type {Exp} */
const first = ['=>', 0, null, ['.', ['args'], 0]]

export const proof = {
    // A primitive is a leaf, written and evaluated in place: `export
    // default 1;` is an empty table with the root `1`.
    primitive: () => {
        table(1, { root: 1, nodes: [], scope: [], shared: [] })
        table('a', { root: 'a', nodes: [], scope: [], shared: [] })
        table(null, { root: null, nodes: [], scope: [], shared: [] })
    },
    // Walk order: depth first from the root, operands as written, a node
    // after its operands and on the first edge that reaches it — the
    // design's own example, `const a = [{}]; export default [a[0], a[0]];`.
    // The two accesses become one entry while `a` still has two edges.
    order: () => {
        /** @type {Exp} */
        const a = ['[]', [['{}', []]]]
        table(['[]', [['.', a, 0], ['.', a, 0]]], {
            root: ['#', 3],
            nodes: [['{}', []], ['[]', [['#', 0]]], ['.', ['#', 1], 0], ['[]', [['#', 2], ['#', 2]]]],
            scope: [-1, -1, -1, -1],
            shared: [1, 2],
        })
    },
    // A constructor mints identity: one node reached twice is one entry,
    // shared, and two nodes spelled the same are two entries, two arrays.
    constructor: () => {
        table(['[]', [empty, empty]], {
            root: ['#', 1],
            nodes: [['[]', []], ['[]', [['#', 0], ['#', 0]]]],
            scope: [-1, -1],
            shared: [0],
        })
        table(['[]', [['[]', []], ['[]', []]]], {
            root: ['#', 2],
            nodes: [['[]', []], ['[]', []], ['[]', [['#', 0], ['#', 1]]]],
            scope: [-1, -1, -1],
            shared: [],
        })
        assertStructurallySame(nodesOf(['[]', [['{}', []], ['{}', []]]]), [['{}', []], ['{}', []], ['[]', [['#', 0], ['#', 1]]]])
        assertEq(nodesOf(['[]', [first, ['=>', 0, null, ['.', ['args'], 0]]]]).length, 7)
    },
    // A plain read is decided by its inputs, so two spelled the same over
    // the same inputs are one entry — shared, since both edges stay — and
    // two over different keys stay apart; the same node twice is the same
    // entry either way.
    access: () => {
        /** @type {Exp} */
        const cfg = ['args']
        /** @type {Exp} */
        const read = ['.', cfg, 'a']
        /** @type {Analysis} */
        const merged = {
            root: ['#', 2],
            nodes: [['args'], ['.', ['#', 0], 'a'], ['[]', [['#', 1], ['#', 1]]]],
            scope: [-1, -1, -1],
            shared: [0, 1],
        }
        table(['[]', [read, read]], merged)
        table(['[]', [['.', cfg, 'a'], ['.', ['args'], 'a']]], merged)
        assertStructurallySame(nodesOf(['[]', [['.', cfg, 'a'], ['.', cfg, 'b']]]), [['args'], ['.', ['#', 0], 'a'], ['.', ['#', 0], 'b'], ['[]', [['#', 1], ['#', 2]]]])
        // A computed key is a `Number` node, an entry of its own, and merges
        // as any operator does.
        assertStructurallySame(nodesOf(['[]', [['.', cfg, ['Number', 'a']], ['.', cfg, ['Number', 'a']]]]),
            [['args'], ['Number', 'a'], ['.', ['#', 0], ['#', 1]], ['[]', [['#', 2], ['#', 2]]]])
        // `own` and `?.` without a continuation are plain reads too.
        assertEq(nodesOf(['[]', [['own', cfg, 'a'], ['own', cfg, 'a']]]).length, 3)
        assertEq(nodesOf(['[]', [['?.', cfg, 'a'], ['?.', cfg, 'a']]]).length, 3)
    },
    // Inputs are the same by `Object.is`: `0` and `-0` are different inputs,
    // so `1 / 0` and `1 / -0` stay two entries, `Infinity` and `-Infinity`;
    // `NaN` is the same as `NaN`, so two operators over it are one.
    is: () => {
        assertStructurallySame(nodesOf(['[]', [['/', 1, 0], ['/', 1, -0]]]), [['/', 1, 0], ['/', 1, -0], ['[]', [['#', 0], ['#', 1]]]])
        assertStructurallySame(nodesOf(['[]', [['+', NaN, 1], ['+', NaN, 1]]]), [['+', NaN, 1], ['[]', [['#', 0], ['#', 0]]]])
        // ... and a different arity or a different primitive is a different spelling.
        assertEq(nodesOf(['[]', [['-', 1], ['-', 1, 1]]]).length, 3)
        assertEq(nodesOf(['[]', [['+', 1, 1], ['+', 1, '1']]]).length, 3)
        assertEq(nodesOf(['[]', [['+', 1, 1], ['+', 1n, 1]]]).length, 3)
    },
    // Operators, the comma and the three operations with no operands merge
    // as reads do; an edge from a lazy position is an edge, so a node
    // reached only through `&&`'s right operand is shared all the same,
    // and the merged `&&` keeps every edge its occurrences gave `s`.
    operators: () => {
        assertEq(nodesOf(['[]', [['args'], ['args']]]).length, 2)
        assertEq(nodesOf(['[]', [['undefined'], ['undefined']]]).length, 2)
        assertEq(nodesOf(['[]', [[',', [1, 2]], [',', [1, 2]]]]).length, 2)
        assertEq(nodesOf(['[]', [['?:', 1, 2, 3], ['?:', 1, 2, 3]]]).length, 2)
        assertEq(nodesOf(['[]', [['is', 1, 1], ['is', 1, 1]]]).length, 2)
        /** @type {Exp} */
        const s = ['[]', [1]]
        table(['[]', [['&&', ['args'], s], ['&&', ['args'], s]]], {
            root: ['#', 3],
            nodes: [['args'], ['[]', [1]], ['&&', ['#', 0], ['#', 1]], ['[]', [['#', 2], ['#', 2]]]],
            scope: [-1, -1, -1, -1],
            shared: [0, 1, 2],
        })
        // Three edges to one node list it once.
        table(['[]', [s, s, s]], { root: ['#', 1], nodes: [['[]', [1]], ['[]', [['#', 0], ['#', 0], ['#', 0]]]], scope: [-1, -1], shared: [0] })
    },
    // A call may mint a fresh result each time, in any spelling, so two are
    // two entries: `()`, `?.()`, and a chain that continues, since only a
    // call can spend the receiver a continuation carries.
    calls: () => {
        /** @type {Exp} */
        const args = ['args']
        assertEq(nodesOf(['[]', [['()', args, args], ['()', args, args]]]).length, 4)
        assertEq(nodesOf(['[]', [['?.()', args, args], ['?.()', args, args]]]).length, 4)
        assertEq(nodesOf(['[]', [['.', args, 'f', ['|()', args]], ['.', args, 'f', ['|()', args]]]]).length, 4)
        assertEq(nodesOf(['[]', [['?.', args, 'f', ['|.', 'g']], ['?.', args, 'f', ['|.', 'g']]]]).length, 4)
        assertEq(nodesOf(['[]', [['?.()', args, args, ['|.', 'g']], ['?.()', args, args, ['|.', 'g']]]]).length, 4)
    },
    // The `=>` boundary is the scope. A body's entries name their `=>`,
    // which comes after them; the frame is walked in the enclosing scope;
    // two scopes never merge, so sibling bodies keep a read each; and a
    // body inside a body names the inner `=>`.
    scope: () => {
        // `(...a) => [a[0], a[0]]` — shared inside the body, cached per call.
        table(['=>', 0, null, ['[]', [['.', ['args'], 0], ['.', ['args'], 0]]]], {
            root: ['#', 3],
            nodes: [['args'], ['.', ['#', 0], 0], ['[]', [['#', 1], ['#', 1]]], ['=>', 0, null, ['#', 2]]],
            scope: [3, 3, 3, -1],
            shared: [0, 1],
        })
        // The count operand belongs to the enclosing scope too.
        table(['=>', ['.', ['args'], 0], null, 5], {
            root: ['#', 2],
            nodes: [['args'], ['.', ['#', 0], 0], ['=>', ['#', 1], null, 5]],
            scope: [-1, -1, -1],
            shared: [],
        })
        // The frame operand belongs to the enclosing scope.
        table(['=>', 0, ['[]', [1]], ['.', ['frame'], 0]], {
            root: ['#', 3],
            nodes: [['[]', [1]], ['frame'], ['.', ['#', 1], 0], ['=>', 0, ['#', 0], ['#', 2]]],
            scope: [-1, 3, 3, -1],
            shared: [],
        })
        // `[(...a) => "x".length, (...b) => "x".length]` keeps a `.` per body.
        table(['[]', [['=>', 0, null, ['.', 'x', 'length']], ['=>', 0, null, ['.', 'x', 'length']]]], {
            root: ['#', 4],
            nodes: [['.', 'x', 'length'], ['=>', 0, null, ['#', 0]], ['.', 'x', 'length'], ['=>', 0, null, ['#', 2]], ['[]', [['#', 1], ['#', 3]]]],
            scope: [1, -1, 3, -1, -1],
            shared: [],
        })
        // A body inside a body: `() => () => "x".length`.
        table(['=>', 0, null, ['=>', 0, null, ['.', 'x', 'length']]], {
            root: ['#', 2],
            nodes: [['.', 'x', 'length'], ['=>', 0, null, ['#', 0]], ['=>', 0, null, ['#', 1]]],
            scope: [1, 2, -1],
            shared: [],
        })
        // A body's primitive root is an operand of the `=>`, and no entry.
        table(['=>', 0, null, 5], { root: ['#', 0], nodes: [['=>', 0, null, 5]], scope: [-1], shared: [] })
    },
    // Every node kind and every step, walked in written order — the shapes
    // `order`, `access`, `calls` and `scope` do not reach.
    kinds: () => {
        /** @type {Exp} */
        const a = ['args']
        // `[a, ...a]`, `{ [a]: a, ...a }`: a spread's operand is walked and
        // the spread kept, a property's key and value are both operands.
        assertStructurallySame(nodesOf(['[]', [a, ['...', a]]]), [['args'], ['[]', [['#', 0], ['...', ['#', 0]]]]])
        assertStructurallySame(nodesOf(['{}', [[':', a, a], ['...', a]]]), [['args'], ['{}', [[':', ['#', 0], ['#', 0]], ['...', ['#', 0]]]]])
        // Every operator shape: one operand, two, three, and both arities of `+`.
        assertStructurallySame(nodesOf(['!', a]), [['args'], ['!', ['#', 0]]])
        assertStructurallySame(nodesOf(['?:', a, a, a]), [['args'], ['?:', ['#', 0], ['#', 0], ['#', 0]]])
        assertStructurallySame(nodesOf(['[]', [['+', a], ['+', a, a]]]), [['args'], ['+', ['#', 0]], ['+', ['#', 0], ['#', 0]], ['[]', [['#', 1], ['#', 2]]]])
        // `a.b?.(...a).c(...a).d`: a step of each kind that continues, each
        // operand an edge — four to `a` here, and the chain one entry.
        table(['.', a, 'b', ['|?.()', a, ['|.', 'c', ['|()', a, ['|.', 'd']]]]], {
            root: ['#', 1],
            nodes: [['args'], ['.', ['#', 0], 'b', ['|?.()', ['#', 0], ['|.', 'c', ['|()', ['#', 0], ['|.', 'd']]]]]],
            scope: [-1, -1],
            shared: [0],
        })
        // `a?.b?.(...a)`, `(a?.b)(...a)` and `a?.b[a](...a)`: the guarded
        // and the escaping step ending a chain, and a computed key in a step.
        assertStructurallySame(nodesOf(['?.', a, 'b', ['|?.()', a]]), [['args'], ['?.', ['#', 0], 'b', ['|?.()', ['#', 0]]]])
        assertStructurallySame(nodesOf(['?.', a, 'b', ['|!()', a]]), [['args'], ['?.', ['#', 0], 'b', ['|!()', ['#', 0]]]])
        assertStructurallySame(nodesOf(['?.', a, 'b', ['|.', ['Number', a], ['|()', a]]]),
            [['args'], ['Number', ['#', 0]], ['?.', ['#', 0], 'b', ['|.', ['#', 1], ['|()', ['#', 0]]]]])
        // `a?.(...a).b`
        assertStructurallySame(nodesOf(['?.()', a, a, ['|.', 'b']]), [['args'], ['?.()', ['#', 0], ['#', 0], ['|.', 'b']]])
    },
    // A node reached from two scopes is not a graph the compiler emits, and
    // the EDAG's scope rule forbids it: refused where it is met, from either
    // side of the boundary.
    throw: {
        outsideThenInside: () => an(['[]', [empty, ['=>', 0, null, empty]]]),
        insideThenOutside: () => an(['[]', [['=>', 0, null, empty], empty]]),
        siblingBodies: () => an(['[]', [['=>', 0, null, empty], ['=>', 0, null, empty]]]),
    },
}
