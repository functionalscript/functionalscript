/**
 * @import { Graph, Shape } from './types.ts'
 */

import { _crossesBox, _crossings, graphOf, ranked, graphSvg } from './module.f.mjs'
import { htmlToString } from '../../../media/html/module.f.mjs'
import { assert, assertEq, assertStructurallySame } from '../../../asserts/module.f.js'
import { occurrences } from '../../../types/string/module.f.mjs'

/**
 * Every drawn edge's `d`, in document order. Each piece of the SVG before
 * an edge's marker attribute ends with that edge's path data.
 *
 * @type {(html: string) => readonly string[]}
 */
const routes = html => html.split('" data-graph-edge=""').slice(0, -1)
    .map(before => before.slice(before.lastIndexOf('d="') + 'd="'.length))

/**
 * Three ranks, one node each, and an edge `r` from the root that skips the
 * middle one — the smallest graph that needs a lane.
 *
 * @type {Graph}
 */
const skipLevel = {
    nodes: [
        { id: 0, kind: 'a', label: '{ }', rank: 0 },
        { id: 1, kind: 'a', label: '{ }', rank: 1 },
        { id: 2, kind: 'a', label: '[ ]', rank: 2 },
    ],
    edges: [
        { from: 0, to: 1, label: 'p' },
        { from: 1, to: 2, label: 'y' },
        { from: 0, to: 2, label: 'r' },
    ],
}

/**
 * A shape for plain arrays: each is a node whose children are its items, a
 * number is inline, and a string is inline under the kind it spells.
 *
 * @type {(v: unknown) => Shape<unknown>}
 */
const arrayShape = v => v instanceof Array
    ? { kind: 'array', label: '[ ]', children: v.map((item, i) => i === 0 ? [`${i}`, item, 'first'] : [`${i}`, item]) }
    : typeof v === 'string' ? { inline: v, kind: v } : { inline: `${v}` }

export const proof = {
    graphOf: {
        // Two edges to one array are one node with two incoming edges, and
        // an equal array written again is a node of its own.
        sharedChild: () => {
            const shared = [1]
            const g = graphOf(arrayShape)([shared, shared, [1]])
            assertStructurallySame(g.nodes, [
                { id: 0, kind: 'array', label: '[ ]', rank: 0 },
                { id: 1, kind: 'array', label: '[ ]', rank: 1 },
                { id: 2, kind: 'array', label: '[ ]', rank: 1 },
            ])
            assertStructurallySame(g.edges, [
                { from: 1, to: { inline: '1' }, label: '0', kind: 'first' },
                { from: 0, to: 1, label: '0', kind: 'first' },
                { from: 0, to: 1, label: '1', kind: undefined },
                { from: 2, to: { inline: '1' }, label: '0', kind: 'first' },
                { from: 0, to: 2, label: '2', kind: undefined },
            ])
        },
        // A shape's groups are its node's; a shape without them leaves the
        // node without the field, as it was.
        groups: () => {
            /** @type {(v: unknown) => Shape<unknown>} */
            const grouped = v => v instanceof Array
                ? { kind: 'array', label: '[ ]', children: v.map((item, i) => [`${i}`, item]), groups: [['g', v.length]] }
                : { inline: `${v}` }
            assertStructurallySame(graphOf(grouped)([1, 2]).nodes, [{ id: 0, kind: 'array', label: '[ ]', groups: [['g', 2]], rank: 0 }])
            assertStructurallySame(graphOf(arrayShape)([1]).nodes, [{ id: 0, kind: 'array', label: '[ ]', rank: 0 }])
        },
        // A root with no port to sit in is a node of the inline's own kind,
        inlineRootWithKind: () => assertStructurallySame(graphOf(arrayShape)('terminal'), {
            nodes: [{ id: 0, kind: 'terminal', label: 'terminal', rank: 0 }],
            edges: [],
        }),
        // or a leaf where it has none.
        inlineRoot: () => assertStructurallySame(graphOf(arrayShape)(1), {
            nodes: [{ id: 0, kind: 'leaf', label: '1', rank: 0 }],
            edges: [],
        }),
        /**
         * **A value that reaches itself is refused**, whether directly or
         * through another node: an edge back to a node the walk is inside
         * has no rank to point right to.
         */
        throw: {
            // `0` is its own child.
            self: () => graphOf(/** @type {(v: number) => Shape<number>} */ (
                v => ({ kind: 'n', label: `${v}`, children: [['self', v]] })))(0),
            // `0`'s child is `1`, whose child is `0` again.
            throughAnother: () => graphOf(/** @type {(v: number) => Shape<number>} */ (
                v => ({ kind: 'n', label: `${v}`, children: [['next', 1 - v]] })))(0),
            // **A back reference with no node to go back to is refused**:
            // the root is inside no node,
            backRoot: () => graphOf(/** @type {(v: unknown) => Shape<unknown>} */ (() => ({ owner: () => true })))(0),
            // and no node takes this one.
            backWithoutOwner: () => graphOf(/** @type {(v: unknown) => Shape<unknown>} */ (
                v => v === 'self' ? { owner: () => false } : arrayShape(v)))(['self']),
        },
        // A back reference is an edge, marked `back`, to the innermost node
        // the walk is inside that `owner` takes, read with the port the walk
        // left it by: the inner array was left by `1`, so it is skipped,
        // and the root, left by `0`, is the owner. It ranks nothing.
        back: () => {
            /** @type {(v: unknown) => Shape<unknown>} */
            const shape = v => v === 'self' ? { owner: (a, port) => a instanceof Array && port === '0' } : arrayShape(v)
            assertStructurallySame(graphOf(shape)([[1, 'self']]), {
                nodes: [
                    { id: 0, kind: 'array', label: '[ ]', rank: 0 },
                    { id: 1, kind: 'array', label: '[ ]', rank: 1 },
                ],
                edges: [
                    { from: 1, to: { inline: '1' }, label: '0', kind: 'first' },
                    { from: 1, to: 0, label: '1', kind: undefined, back: true },
                    { from: 0, to: 1, label: '0', kind: 'first' },
                ],
            })
        },
        // A node shape can explicitly permit recursive uses of its own
        // identity. Both direct and mutual recursion close with back edges;
        // a later shared use still points forward to the one definition.
        recursive: () => {
            /** @type {(v: number) => Shape<number>} */
            const shape = v => ({ kind: 'n', label: `${v}`, recursive: true,
                children: v === 0 ? [['self', 0], ['first', 1], ['shared', 1]] : [['parent', 0]] })
            const g = graphOf(shape)(0)
            assertStructurallySame(g.nodes.map(n => n.rank), [0, 1])
            assertStructurallySame(g.edges, [
                { from: 0, to: 0, label: 'self', kind: undefined, back: true },
                { from: 1, to: 0, label: 'parent', kind: undefined, back: true },
                { from: 0, to: 1, label: 'first', kind: undefined },
                { from: 0, to: 1, label: 'shared', kind: undefined },
            ])
            assertEq(_crossings(g), 0)
        },
        // A value reached again from outside the node it is under is shared,
        // not a cycle: `0` reaches `1` directly and through `2`.
        sharedIsNotACycle: () => {
            const g = graphOf(/** @type {(v: number) => Shape<number>} */ (
                v => ({ kind: 'n', label: `${v}`, children: v === 0 ? [['a', 1], ['b', 2]] : v === 2 ? [['c', 1]] : [] })))(0)
            assertStructurallySame(g.nodes.map(n => n.rank), [0, 2, 1])
        },
        /**
         * **A long path does not use the call stack.** The walk keeps its
         * own stack, so a graph as deep as a chain of two thousand links —
         * the EDAG demo draws one node per link — is walked, where a
         * recursive walk ran out of stack.
         */
        deepPath: () => {
            const n = 2000
            const g = graphOf(/** @type {(v: number) => Shape<number>} */ (
                v => v === 0 ? { inline: '0' } : { kind: 'n', label: `${v}`, children: [['next', v - 1]] }))(n)
            assertEq(g.nodes.length, n)
            assertEq(g.nodes[n - 1].rank, n - 1)
        },
    },
    ranked: {
        // The root alone is rank 0.
        rootAlone: () => {
            const r = ranked([{ id: 0, kind: 'leaf', label: 'x' }], [])
            assertEq(r.length, 1)
            assertEq(r[0].rank, 0)
        },
        // A chain ranks one deeper per edge.
        chain: () => {
            const nodes = [
                { id: 0, kind: 'a', label: 'root' },
                { id: 1, kind: 'a', label: 'mid' },
                { id: 2, kind: 'leaf', label: 'leaf' },
            ]
            const edges = [{ from: 0, to: 1, label: 'x' }, { from: 1, to: 2, label: 'y' }]
            assertStructurallySame(ranked(nodes, edges).map(n => n.rank), [0, 1, 2])
        },
        /**
         * **A node reached by two routes of different length ranks by the
         * longer one** — the one thing a first-discovery walk gets wrong,
         * and the reason this module ranks by longest path rather than by
         * when a walk first arrives.
         */
        longestPathWins: () => {
            const nodes = [
                { id: 0, kind: 'a', label: 'root' },
                { id: 1, kind: 'a', label: 'mid' },
                { id: 2, kind: 'leaf', label: 'shared' },
            ]
            // 0->2 directly (length 1) and 0->1->2 (length 2) both reach id 2.
            const edges = [
                { from: 0, to: 2, label: 'direct' },
                { from: 0, to: 1, label: 'via' },
                { from: 1, to: 2, label: 'long' },
            ]
            assertEq(ranked(nodes, edges).find(n => n.id === 2)?.rank, 2)
        },
        // A back edge is not a path, so it ranks nothing.
        back: () => {
            const nodes = [{ id: 0, kind: 'a', label: 'f' }, { id: 1, kind: 'a', label: 'g' }]
            const edges = [{ from: 0, to: 1, label: 'x' }, { from: 1, to: 0, label: 'y', back: true }]
            assertStructurallySame(ranked(nodes, edges).map(n => n.rank), [0, 1])
        },
    },
    graphSvg: {
        /**
         * **A back edge goes around the graph.** It leaves `g`'s port at
         * x=160, goes down a lane right of its column, x=170, to a lane
         * below the graph, y=40, left to a lane left of `f`'s column,
         * x=10, and up into `f`'s middle. Each of those two lanes widens
         * its gap, so `f` starts at x=20 and the drawing ends a margin
         * past them. With back edges left out the graph is a tree, and is
         * drawn as one.
         */
        back: () => {
            /** @type {Graph} */
            const g = {
                nodes: [{ id: 0, kind: 'a', label: 'f', rank: 0 }, { id: 1, kind: 'a', label: 'g', rank: 1 }],
                edges: [{ from: 0, to: 1, label: 'x' }, { from: 1, to: 0, label: 'y', back: true }],
            }
            const html = htmlToString(graphSvg(g))
            assertEq(JSON.stringify(routes(html)), '["M70,20 L110,20","M160,20 L170,20 L170,40 L10,40 L10,20 L20,20"]')
            assert(html.includes('viewBox="0 0 180 50"'), html)
            assertEq(_crossings(g), 0)
        },
        /**
         * **Of two back edges spanning as many ranks, the lower is nearer
         * the graph**, so the higher one, `a`, goes down right of where
         * `b` leaves, x=190 past x=180, and below it, y=70 past y=60.
         */
        backLanes: () => {
            /** @type {Graph} */
            const g = {
                nodes: [{ id: 0, kind: 'a', label: 'f', rank: 0 }, { id: 1, kind: 'a', label: 'g', rank: 1 }],
                edges: [{ from: 0, to: 1, label: 'x' }, { from: 1, to: 0, label: 'a', back: true }, { from: 1, to: 0, label: 'b', back: true }],
            }
            assertEq(JSON.stringify(routes(htmlToString(graphSvg(g))).slice(1)),
                '["M170,20 L190,20 L190,70 L10,70 L10,30 L30,30","M170,40 L180,40 L180,60 L20,60 L20,30 L30,30"]')
            assertEq(_crossings(g), 0)
        },
        /**
         * **A narrower back edge is nearer the graph**: `g`'s edge to
         * itself, one rank, is inside `h`'s edge to `f`, two, in a lane
         * above it at y=60 and a gap of its own left of `g`, x=110.
         */
        backNested: () => {
            /** @type {Graph} */
            const g = {
                nodes: [{ id: 0, kind: 'a', label: 'f', rank: 0 }, { id: 1, kind: 'a', label: 'g', rank: 1 }, { id: 2, kind: 'a', label: 'h', rank: 2 }],
                edges: [{ from: 0, to: 1, label: 'x' }, { from: 1, to: 2, label: 'x' }, { from: 1, to: 1, label: 'b', back: true }, { from: 2, to: 0, label: 'a', back: true }],
            }
            assertEq(JSON.stringify(routes(htmlToString(graphSvg(g))).slice(2)),
                '["M170,40 L180,40 L180,60 L110,60 L110,30 L120,30","M270,30 L280,30 L280,70 L10,70 L10,30 L20,30"]')
            assertEq(_crossings(g), 0)
        },
        // Shared returns use one lane and one arrowhead per destination and
        // kind. Different destinations and dashed/solid edges remain separate.
        bundledBacks: () => {
            /** @type {Graph} */
            const g = {
                bundleBacks: true,
                nodes: [0, 1, 2, 3].map(id => ({ id, kind: 'n', label: `${id}`, rank: id })),
                edges: [
                    { from: 0, to: 1, label: '' }, { from: 1, to: 2, label: '' }, { from: 2, to: 3, label: '' },
                    { from: 2, to: 0, label: 'a', back: true },
                    { from: 3, to: 1, label: 'b', back: true },
                    { from: 3, to: 0, label: 'c', back: true },
                    { from: 3, to: 0, label: 'd', kind: 'lazy', back: true },
                    { from: 3, to: 0, label: 'e', back: true },
                ],
            }
            const html = htmlToString(graphSvg(g))
            const paths = routes(html)
            assertEq(paths.length, 8)
            assertEq(paths[3].split(' L').slice(3).join(' L'), paths[5].split(' L').slice(3).join(' L'))
            assert(paths[5].split(' L')[3] !== paths[6].split(' L')[3], 'different edge kinds have separate lanes')
            assert(paths[4].split(' L')[3] !== paths[5].split(' L')[3], 'different targets have separate lanes')
            assertEq(paths[5].split(' L').slice(2).join(' L'), paths[7].split(' L').slice(2).join(' L'))
            assertEq(occurrences('marker-end="url(#graph-arrow)"')(html), 6)
            assertEq(_crossings(g), 0)
        },
        // Two definitions in the same column remain separate destinations.
        // Rank alone must not merge their returns or their arrowheads.
        bundledDistinctTargets: () => {
            /** @type {Graph} */
            const g = {
                bundleBacks: true,
                nodes: [
                    { id: 0, kind: 'n', label: 'root', rank: 0 },
                    { id: 1, kind: 'n', label: 'left', rank: 1 },
                    { id: 2, kind: 'n', label: 'right', rank: 1 },
                    { id: 3, kind: 'n', label: 'use', rank: 2 },
                ],
                edges: [
                    { from: 0, to: 1, label: '' }, { from: 0, to: 2, label: '' },
                    { from: 1, to: 3, label: '' }, { from: 2, to: 3, label: '' },
                    { from: 3, to: 1, label: 'left', back: true }, { from: 3, to: 2, label: 'right', back: true },
                ],
            }
            const html = htmlToString(graphSvg(g))
            const paths = routes(html)
            assert(paths[4].split(' L')[2] !== paths[5].split(' L')[2], 'separate bottom lanes')
            assertEq(occurrences('marker-end="url(#graph-arrow)"')(html), 6)
            assertEq(_crossings(g), 0)
        },
        // Native focus makes click and keyboard selection trace the same
        // complete route as hover. A self edge outlines its one endpoint once.
        tracing: () => {
            const html = htmlToString(graphSvg({
                trace: true, bundleBacks: true,
                nodes: [{ id: 0, kind: 'n', label: 'root', rank: 0 }, { id: 1, kind: 'n', label: 'child', rank: 1 }],
                edges: [
                    { from: 0, to: 1, label: 'item' }, { from: 1, to: 1, label: 'self', back: true },
                    { from: 0, to: { inline: '42' }, label: 'constant' },
                ],
            }))
            assertEq(occurrences(' data-graph-connection=')(html), 2)
            assertEq(occurrences('tabindex="0"')(html), 2)
            assertEq(occurrences('data-graph-hit=')(html), 2)
            assertEq(occurrences('data-graph-trace=""')(html), 7)
            assertEq(occurrences('data-graph-port-outline=')(html), 2)
            assertEq(occurrences(' data-graph-port-edge=')(html), 6)
            assertEq(occurrences(' data-graph-node-name=')(html), 2)
            assert(html.includes('data-graph-from="0" data-graph-to="1"'), html)
            assert(html.includes('svg:has([data-graph-port-edge="0"]:hover) [data-graph-connection="0"]'), html)
            assert(html.includes('svg:has([data-graph-node-name="1"]:hover) :is([data-graph-from="1"], [data-graph-to="1"])'), html)
            assert(html.includes('aria-label="root [item] → child"'), html)
            assert(html.includes('aria-label="child [self] → child (recursive)"'), html)
            assert(html.includes('id="graph-trace-arrow"'), html)
        },
        // A node's rect and label render, and so does an edge's path and label.
        rendersNodesAndEdges: () => {
            const html = htmlToString(graphSvg({
                nodes: [
                    { id: 0, kind: 'container', label: 'root', rank: 0 },
                    { id: 1, kind: 'leaf', label: '42', rank: 1 },
                ],
                edges: [{ from: 0, to: 1, label: 'x' }],
            }))
            assert(html.includes('data-graph-kind="container"'), html)
            assert(html.includes('data-graph-kind="leaf"'), html)
            assert(html.includes('>root<'), html)
            assert(html.includes('>42<'), html)
            assert(html.includes('>x<'), html)
            // A node is drawn in two groups, its box and its text, each
            // carrying its kind under a name of its own, so a rule can reach
            // the whole node.
            assertEq(occurrences('<g data-graph-in-kind="container">')(html), 2)
            assertEq(occurrences('<g data-graph-in-kind="leaf">')(html), 2)
            assert(html.includes('<g data-graph-in-kind="container"><text'), html)
        },
        // An entry is an arrow from nowhere into a node, level with where
        // an edge would arrive. The first column moves right by an arrow's
        // length to make room: the first node is at x=34, and its middle,
        // y=23, is where its arrow arrives. A node with no entry
        // gets no arrow.
        entries: () => {
            const html = htmlToString(graphSvg({
                nodes: [{ id: 0, kind: 'a', label: 'n', rank: 0 }, { id: 1, kind: 'a', label: 'm', rank: 0 }],
                edges: [],
                entries: [{ to: 0, kind: 'old' }],
            }))
            assert(html.includes('<rect x="34" y="10" width="50" height="26" rx="4" data-graph-node=""'), html)
            assert(html.includes('<path d="M10,23 L34,23" data-graph-edge="" data-graph-entry="" marker-end="url(#graph-arrow)" data-graph-edge-kind="old">'), html)
            assertEq(occurrences('data-graph-entry=""')(html), 1)
        },
        // An edge with a corner takes no row: the node is its title beside
        // one 20px value row, 20px tall, and its three edges leave its
        // right side, x=60, from the top corner, the middle and the bottom
        // corner. It is a tree, so the node is centred on its three
        // children, 10 to 116: at y=53, its middle edge level with the
        // middle child's.
        corners: () => {
            const html = htmlToString(graphSvg({
                nodes: [
                    { id: 0, kind: 'a', label: 'n', rank: 0 },
                    { id: 1, kind: 'a', label: 'a', rank: 1 },
                    { id: 2, kind: 'a', label: 'b', rank: 1 },
                    { id: 3, kind: 'a', label: 'c', rank: 1 },
                ],
                edges: [
                    { from: 0, to: 1, label: '', corner: 'top' },
                    { from: 0, to: { inline: '5' }, label: '' },
                    { from: 0, to: 2, label: '', corner: 'middle' },
                    { from: 0, to: 3, label: '', corner: 'bottom' },
                ],
            }))
            assert(html.includes('<rect x="10" y="53" width="50" height="20" rx="4" data-graph-node=""'), html)
            assertEq(occurrences('data-graph-port=""')(html), 0)
            const starts = routes(html).map(d => d.split(' ')[0])
            assertEq(JSON.stringify(starts), '["M60,53","M60,63","M60,73"]')
            assert(routes(html)[1].endsWith('L100,63'), html)
        },
        // A value in parts is one text of tspans, each marked with its
        // kind; a value without parts is plain text, as before.
        inlineParts: () => {
            const html = htmlToString(graphSvg({
                nodes: [{ id: 0, kind: 'a', label: '', rank: 0 }],
                edges: [
                    { from: 0, to: { inline: '0101', parts: [['01', 'prior'], ['01', 'current']] }, label: '' },
                    { from: 0, to: { inline: '7' }, label: '' },
                ],
            }))
            assert(html.includes('data-graph-value-label=""><tspan data-graph-part="prior">01</tspan><tspan data-graph-part="current">01</tspan></text>'), html)
            assert(html.includes('data-graph-value-label="">7</text>'), html)
        },
        // A value with a click is a control on its cell, and its text lets
        // the pointer through to it; a value without one is neither.
        // A node with an order carries it on both of its groups, box and
        // text; a node without one carries none. An edge fades with the
        // node it leads to if that one has an order, else with the node it
        // leaves; an entry fades with its node; an edge between two nodes
        // without one does not fade.
        order: () => {
            const html = htmlToString(graphSvg({
                nodes: [
                    { id: 0, kind: 'new', label: 'a', rank: 0, order: 0 },
                    { id: 1, kind: 'shared', label: 'b', rank: 1 },
                    { id: 2, kind: 'new', label: 'c', rank: 1, order: 1 },
                    { id: 3, kind: 'shared', label: 'd', rank: 2 },
                ],
                edges: [{ from: 0, to: 1, label: '' }, { from: 0, to: 2, label: '' }, { from: 1, to: 3, label: '' }],
                entries: [{ to: 0 }],
            }))
            assertEq(occurrences('<g data-graph-in-kind="new" data-graph-order="0"')(html), 2)
            assertEq(occurrences('<g data-graph-in-kind="new" data-graph-order="1"')(html), 2)
            /** @type {(s: string) => readonly string[]} */
            const paths = s => s.split('<path ').slice(1).flatMap(p => p.includes('data-graph-edge=""') ? [p.slice(0, p.indexOf('>'))] : [])
            const fades = paths(html).map(p => p.includes('data-graph-order="0"') ? 0 : p.includes('data-graph-order="1"') ? 1 : null)
            // 0 → 1 with 0, 0 → 2 with 2, 1 → 3 with neither, the entry with 0.
            assertEq(JSON.stringify(fades.toSorted()), '[0,0,1,null]')
        },
        // A keyed node is drawn at the origin, its box and its text each in
        // a group moved into place and keyed apart, its clip local too; an
        // unkeyed one is drawn where it is. An edge or entry between keyed
        // nodes is keyed by them, drawn by key, its route one point longer
        // than its bend so routes slide into one another.
        keyed: () => {
            const html = htmlToString(graphSvg({
                nodes: [
                    { id: 0, kind: 'shared', label: '', rank: 0, key: 'k' },
                    { id: 1, kind: 'shared', label: 'b', rank: 1, key: 'b' },
                    { id: 2, kind: 'shared', label: 'c', rank: 1 },
                ],
                edges: [{ from: 0, to: { inline: '5' }, label: '' }, { from: 0, to: 1, label: '' }, { from: 0, to: 2, label: '' }],
                entries: [{ to: 0 }],
            }))
            // The keyed groups are drawn by key, in a layer each: `b`
            // before `k`, and the unkeyed node after both, in its layer.
            const keys = html.split('data-key="').slice(1).map(k => k.slice(0, k.indexOf('"')))
            assertEq(JSON.stringify(keys), '["box:b","box:k","edge:[&quot;k&quot;,&quot;1&quot;,&quot;b&quot;]","entry:[&quot;k&quot;]","text:b","text:k"]')
            assert(html.includes('</defs><g><g data-graph-in-kind="shared" transform="translate(124,10)" data-key="box:b">'), html)
            // A keyed node is drawn at the origin, its clip too; the unkeyed
            // one where it is.
            assert(html.includes('transform="translate(34,13)" data-key="box:k"><rect x="0" y="0" width="50" height="60"'), html)
            assert(html.includes('<clipPath id="graph-clip-34-13-50-60"><rect x="0" y="0" width="50" height="60" rx="4"></rect></clipPath>'), html)
            assert(html.includes('<g data-graph-in-kind="shared"><rect x="124" y="50"'), html)
            // Nothing has an order, so nothing fades.
            assert(!html.includes('data-graph-order'), html)
            // The edge to the unkeyed node has no key and comes first; every
            // route of a keyed graph is three points, a straight run doubled.
            assert(html.includes('<g><path d="M84,63 L84,63 L124,63" data-graph-edge="" marker-end="url(#graph-arrow)"></path>'), html)
            assert(html.includes('<path d="M84,43 L84,43 L124,23" data-graph-edge="" marker-end="url(#graph-arrow)" data-key="edge:[&quot;k&quot;,&quot;1&quot;,&quot;b&quot;]">'), html)
            // The svg is the defs and three layers, boxes, edges and labels,
            // however many edges there are, so a patch meets each layer
            // where it was.
            /** @type {(edges: Graph['edges']) => string} */
            const tags = edges => {
                const div = /** @type {readonly unknown[]} */ (graphSvg({ nodes: [{ id: 0, kind: 'shared', label: 'a', rank: 0, key: 'a' }, { id: 1, kind: 'shared', label: 'b', rank: 1, key: 'b' }], edges }))
                const svg = /** @type {readonly (readonly unknown[])[]} */ (div[2])
                return JSON.stringify(svg.slice(2).map(child => child[0]))
            }
            assertEq(tags([]), '["defs","g","g","g"]')
            assertEq(tags([{ from: 0, to: 1, label: '' }]), '["defs","g","g","g"]')
        },
        inlineClick: () => {
            const html = htmlToString(graphSvg({
                nodes: [{ id: 0, kind: 'a', label: '', rank: 0 }],
                edges: [
                    { from: 0, to: { inline: '5', click: { name: 'move:5', label: 'Move 5' } }, label: '' },
                    { from: 0, to: { inline: '7' }, label: '' },
                ],
            }))
            assert(html.includes('data-demo-click="move:5" tabindex="0" role="button" aria-label="Move 5" pointer-events="all" cursor="pointer"'), html)
            assert(html.includes('pointer-events="none">5</text>'), html)
            assert(html.includes('data-graph-value-label="">7</text>'), html)
            assertEq(occurrences('data-demo-click')(html), 1)
        },
        // An empty label is no column when a node has ports: each node is
        // its rows alone, and the edge runs from the middle of the first row
        // to the middle of the second's. A node with no ports keeps its
        // 26px label, or it would have no size. The root's two rows are
        // centred on its children, 10 to 70, so it sits at y=20 and its
        // first edge runs from (60,30) to (100,20).
        emptyLabel: () => {
            const html = htmlToString(graphSvg({
                nodes: [
                    { id: 0, kind: 'a', label: '', rank: 0 },
                    { id: 1, kind: 'a', label: '', rank: 1 },
                    { id: 2, kind: 'a', label: '', rank: 1 },
                ],
                edges: [
                    { from: 0, to: 1, label: 'x' },
                    { from: 1, to: { inline: '1' }, label: 'v' },
                    { from: 0, to: 2, label: 'y' },
                ],
            }))
            assert(!html.includes('data-graph-label'), html)
            assert(html.includes('<rect x="10" y="20" width="50" height="40" rx="4" data-graph-node=""'), html)
            assert(html.includes('<rect x="100" y="10" width="50" height="20" rx="4" data-graph-node=""'), html)
            assert(html.includes('<rect x="100" y="44" width="50" height="26" rx="4" data-graph-node=""'), html)
            assertEq(routes(html)[0], 'M60,30 L100,20')
        },
        // A node with groups draws a cell per group in its label column,
        // each beside its own rows and as wide as the widest group's
        // label, `bb`'s 26px, and its text centred on them. The node's own
        // label is not drawn, nor does it widen the node: three rows of a
        // 24px key and a 24px value beside the 26px column.
        groups: () => {
            const html = htmlToString(graphSvg({
                nodes: [{ id: 0, kind: 'a', label: 'a whole', rank: 0, groups: [['a', 2], ['bb', 1]] }],
                edges: [
                    { from: 0, to: { inline: '1' }, label: 'k' },
                    { from: 0, to: { inline: '2' }, label: 'k' },
                    { from: 0, to: { inline: '3' }, label: 'k' },
                ],
            }))
            assert(html.includes('<rect x="10" y="10" width="74" height="60" rx="4" data-graph-node=""'), html)
            assert(html.includes('<rect x="10" y="10" width="26" height="40" data-graph-group="">'), html)
            assert(html.includes('<rect x="10" y="50" width="26" height="20" data-graph-group="">'), html)
            assert(html.includes('<text x="23" y="30" text-anchor="middle" data-graph-label="">a<'), html)
            assert(html.includes('<text x="23" y="60" text-anchor="middle" data-graph-label="">bb<'), html)
            assert(!html.includes('>a whole<'), html)
        },
        // A value whose key is empty fills its row: no key cell, no key
        // text, and the value centred across the whole 50px node. A keyed
        // value in the same node keeps its key cell.
        emptyKey: () => {
            const html = htmlToString(graphSvg({
                nodes: [{ id: 0, kind: 'a', label: '', rank: 0 }],
                edges: [
                    { from: 0, to: { inline: '5' }, label: '' },
                    { from: 0, to: { inline: '6' }, label: 'k' },
                ],
            }))
            assert(html.includes('<rect x="10" y="10" width="50" height="20" data-graph-value="" data-graph-value-alone="">'), html)
            assert(html.includes('<text x="35" y="20" text-anchor="middle" data-graph-value-label="">5<'), html)
            assertEq(occurrences('data-graph-port=""')(html), 1)
            assert(html.includes('<rect x="34" y="30" width="26" height="20" data-graph-value="">'), html)
        },
        // An edge beside a value draws its target's label
        // in the value's place, marked as a reference, and a keyed one its
        // key in the key column; a lazy one's kind stays on its line. A
        // target with no label of its own leaves the row as it was.
        refRow: () => {
            const html = htmlToString(graphSvg({
                nodes: [{ id: 0, kind: 'a', label: 'or', rank: 0 }, { id: 1, kind: 'a', label: '{}', rank: 1 }, { id: 2, kind: 'a', label: 'x', rank: 1 }, { id: 3, kind: 'a', label: '', rank: 1 }],
                edges: [{ from: 0, to: { inline: '5' }, label: '' }, { from: 0, to: 1, label: '' }, { from: 0, to: 2, label: 'k', kind: 'lazy' }, { from: 0, to: 3, label: '' }],
            }))
            assert(html.includes('data-graph-value-alone="" data-graph-value-ref="">'), html)
            assert(html.includes('data-graph-value-label="" data-graph-value-ref="">{}<'), html)
            assert(html.includes('<rect x="36" y="63" width="24" height="20" data-graph-port="">'), html)
            assert(html.includes('data-graph-edge-label="">k<'), html)
            assert(html.includes('data-graph-value-label="" data-graph-value-ref="">x<'), html)
            assertEq(occurrences('data-graph-value-ref=""')(html), 4)
            assertEq(occurrences('data-graph-edge-kind="lazy"')(html), 1)
        },
        // Rows that are all edges with empty keys draw nothing: the node is
        // its 50px label alone, two rows tall, and each edge leaves from the
        // middle of its own row.
        blankPorts: () => {
            const html = htmlToString(graphSvg({
                nodes: [{ id: 0, kind: 'a', label: 'or', rank: 0 }, { id: 1, kind: 'a', label: 'x', rank: 1 }, { id: 2, kind: 'a', label: 'y', rank: 1 }],
                edges: [{ from: 0, to: 1, label: '' }, { from: 0, to: 2, label: '' }],
            }))
            assert(html.includes('<rect x="10" y="23" width="50" height="40" rx="4" data-graph-node=""'), html)
            assert(!html.includes('data-graph-port=""'), html)
            assert(!html.includes('data-graph-edge-label=""'), html)
            assert(html.includes('<text x="35" y="43" text-anchor="middle" data-graph-label="">or<'), html)
            assertEq(routes(html).map(d => d.split(' ')[0]).join(' '), 'M60,33 M60,53')
        },
        /**
         * **An edge's label sits in a port of its own node**, not on the
         * line: the node is its label beside a row per outgoing edge, and
         * the edge leaves from the right end of its row. Pinned by the
         * exact geometry — `root`'s 40px label column beside a 24px row,
         * a 64px node 20px tall, so the row's label is centred at x=62 and
         * the line starts at the node's right side, x=74, and ends at the
         * middle of the next column's node's left side. The child is
         * taller than the root, so the root moves down to be centred on
         * it, at y=13, and the line runs level at y=23.
         */
        labelInAPort: () => {
            const html = htmlToString(graphSvg({
                nodes: [
                    { id: 0, kind: 'a', label: 'root', rank: 0 },
                    { id: 1, kind: 'leaf', label: '42', rank: 1 },
                ],
                edges: [{ from: 0, to: 1, label: 'x' }],
            }))
            assert(html.includes('<rect x="10" y="13" width="64" height="20" rx="4" data-graph-node=""'), html)
            assert(html.includes('<rect x="50" y="13" width="24" height="20" data-graph-port="">'), html)
            assert(html.includes('<text x="30" y="23" text-anchor="middle" data-graph-label="">root<'), html)
            assert(html.includes('<text x="62" y="23" text-anchor="middle" data-graph-edge-label="">x<'), html)
            assert(html.includes('d="M74,23 L114,23"'), html)
        },
        /**
         * **Nodes are found by id, not by position.** A `Graph` does not
         * promise its nodes in id order. Given the child first, the port
         * still hangs on the root and the edge still points right from it;
         * given the skip-level graph backwards, `r` still gets its lane.
         * Either way the drawing is the one the id-ordered graph draws.
         */
        nodesOutOfIdOrder: () => {
            const edges = [{ from: 0, to: 1, label: 'x' }]
            const root = { id: 0, kind: 'a', label: 'root', rank: 0 }
            const child = { id: 1, kind: 'leaf', label: '42', rank: 1 }
            const html = htmlToString(graphSvg({ nodes: [child, root], edges }))
            assert(html.includes('<rect x="50" y="13" width="24" height="20" data-graph-port="">'), html)
            assert(html.includes('d="M74,23 L114,23"'), html)
            assertEq(html, htmlToString(graphSvg({ nodes: [root, child], edges })))
            assertEq(
                htmlToString(graphSvg({ ...skipLevel, nodes: skipLevel.nodes.toReversed() })),
                htmlToString(graphSvg(skipLevel)))
        },
        // A node with no outgoing edge has no ports, and is its label's
        // 26px alone — a leaf is the size it always was.
        noPortsWithoutEdges: () => {
            const html = htmlToString(graphSvg({
                nodes: [{ id: 0, kind: 'leaf', label: '42', rank: 0 }],
                edges: [],
            }))
            assert(!html.includes('data-graph-port'), html)
            assert(html.includes('height="26" rx="4"'), html)
        },
        /**
         * **Two edges to one node are two ports and two lines**, each its
         * own label. From one shared point they would land on one curve,
         * which an earlier version merged into a single line labelled
         * `a, b`; from a row each, they start apart and need nothing.
         */
        parallelEdgesAreTwoPorts: () => {
            const html = htmlToString(graphSvg({
                nodes: [
                    { id: 0, kind: 'container', label: 'root', rank: 0 },
                    { id: 1, kind: 'leaf', label: 'shared', rank: 1 },
                ],
                edges: [
                    { from: 0, to: 1, label: 'a' },
                    { from: 0, to: 1, label: 'b' },
                ],
            }))
            assertEq(occurrences('data-graph-port=""')(html), 2)
            assertEq(occurrences('data-graph-edge=""')(html), 2)
            assert(html.includes('data-graph-edge-label="">a<'), html)
            assert(html.includes('data-graph-edge-label="">b<'), html)
            assert(!html.includes('>a, b<'), html)
            // Each from the middle of its own 20px row.
            assert(html.includes('d="M74,20 '), html)
            assert(html.includes('d="M74,40 '), html)
            // Keyed, the two are told apart by their slots.
            const keyed = htmlToString(graphSvg({
                nodes: [
                    { id: 0, kind: 'container', label: 'root', rank: 0, key: 'r' },
                    { id: 1, kind: 'leaf', label: 'shared', rank: 1, key: 's' },
                ],
                edges: [
                    { from: 0, to: 1, label: 'a' },
                    { from: 0, to: 1, label: 'b' },
                ],
            }))
            assert(keyed.includes('data-key="edge:[&quot;r&quot;,&quot;0&quot;,&quot;s&quot;]"') && keyed.includes('data-key="edge:[&quot;r&quot;,&quot;1&quot;,&quot;s&quot;]"'), keyed)
            // Keys holding the separator a joined key would use still give
            // two edges two keys.
            const slashed = htmlToString(graphSvg({
                nodes: [
                    { id: 0, kind: 'a', label: '', rank: 0, key: 'a/0' },
                    { id: 1, kind: 'a', label: '', rank: 0, key: 'a' },
                    { id: 2, kind: 'a', label: '', rank: 1, key: 'c' },
                    { id: 3, kind: 'a', label: '', rank: 1, key: '0/c' },
                ],
                edges: [{ from: 0, to: 2, label: '' }, { from: 1, to: 3, label: '' }],
            }))
            const edgeKeys = slashed.split('data-key="edge:').slice(1).map(k => k.slice(0, k.indexOf('"')))
            assertEq(new Set(edgeKeys).size, 2)
        },
        /**
         * **A node is as wide as its label column and its widest key
         * together**, and as tall as its rows. Six nine-letter keys at
         * 7px a letter are 82px, beside the 26px column of `[]`: 108px
         * wide, six 20px rows, each key filling its row, and the label
         * centred on all six.
         */
        portsWidenTheNode: () => {
            const html = htmlToString(graphSvg({
                nodes: [
                    { id: 0, kind: 'a', label: '[]', rank: 0 },
                    { id: 1, kind: 'leaf', label: '1', rank: 1 },
                ],
                edges: [0, 1, 2, 3, 4, 5].map(i => ({ from: 0, to: 1, label: `longlabel${i}` })),
            }))
            assert(html.includes('<rect x="10" y="10" width="108" height="120"'), html)
            assert(html.includes('<rect x="36" y="110" width="82" height="20" data-graph-port="">'), html)
            assert(html.includes('<text x="23" y="70" text-anchor="middle" data-graph-label="">[]<'), html)
        },
        /**
         * **An edge that skips a rank runs across a lane of its own** —
         * asserted by the exact route, since the layout is pure arithmetic
         * over the input. `r` skips rank 1, so that column gets a 10px
         * lane placed just after `r`'s source, ahead of the node there:
         * centred at y=15, and the node moves down to y=34. The column is
         * 57px wide, so the lane spans x=107 to 164 and `r` runs straight
         * across it; `p` and `y`, one rank each, are single segments
         * across a gap.
         */
        laneForASkipLevelEdge: () => {
            const html = htmlToString(graphSvg(skipLevel))
            assert(html.includes('d="M67,40 L107,15 L164,15 L204,23"'), html) // r: through its lane
            assert(html.includes('d="M67,20 L107,44"'), html) // p: one rank, one segment
            assert(html.includes('d="M164,44 L204,23"'), html) // y: one rank, one segment
            assert(html.includes('<rect x="107" y="34" width="57" height="20"'), html)
            // The lane is part of the drawing's height, not just the nodes.
            assert(html.includes('viewBox="0 0 264 64"'), html)
        },
        // The middle column is 44px tall including its routing lane and
        // gap. Centering moves the 40px root down 2px and the 26px leaf
        // down 9px, while keeping the tallest column and its lane in place.
        centeredColumns: () => {
            const g = { ...skipLevel, centerColumns: true }
            const html = htmlToString(graphSvg(g))
            assert(html.includes('<rect x="10" y="12" width="57" height="40"'), html)
            assert(html.includes('<rect x="107" y="34" width="57" height="20"'), html)
            assert(html.includes('<rect x="204" y="19" width="50" height="26"'), html)
            assert(html.includes('d="M67,42 L107,15 L164,15 L204,32"'), html)
            assert(html.includes('viewBox="0 0 264 64"'), html)
            assertEq(_crossings(g), 0)
            assertEq(html, htmlToString(graphSvg({ ...g, nodes: g.nodes.toReversed() })))
        },
        // A short column containing only a lane moves with that lane, so
        // its skip-rank edge stays centered between the source and target.
        centeredLaneOnlyColumn: () => {
            /** @type {Graph} */
            const g = {
                centerColumns: true,
                nodes: [{ id: 0, kind: 'n', label: 'root', rank: 0 }, { id: 1, kind: 'n', label: 'leaf', rank: 2 }],
                edges: [{ from: 0, to: 1, label: 'x' }],
            }
            const html = htmlToString(graphSvg(g))
            assertEq(routes(html)[0], 'M74,23 L114,23 L124,23 L164,23')
            assertEq(_crossings(g), 0)
        },
        /**
         * **No edge crosses a box** — the claim the lanes exist for,
         * counted rather than eyeballed. A lane-less layout drew `r` from
         * the root straight to rank 2, through the node on rank 1.
         */
        // A node with no label column takes an edge at its middle: a B-tree
        // leaf of two keys, 40px tall at y=10, is reached at y=30, between
        // its keys, not at the first one's middle, y=20.
        entryAtTheMiddle: () => {
            const html = htmlToString(graphSvg({
                nodes: [{ id: 0, kind: 'a', label: 'n', rank: 0 }, { id: 1, kind: 'a', label: '', rank: 1 }],
                edges: [
                    { from: 0, to: 1, label: '', corner: 'top' },
                    { from: 1, to: { inline: '70' }, label: '' },
                    { from: 1, to: { inline: '80' }, label: '' },
                ],
            }))
            assert(html.includes('<rect x="100" y="10" width="50" height="40" rx="4" data-graph-node=""'), html)
            assert(routes(html)[0].endsWith('L100,30'), html)
        },
        /**
         * **A tree draws each parent beside its children.** The root has
         * two children, and each of those two leaves: the leaves stack in
         * the last column, each parent is centred on its two leaves, and
         * the root on its two children — not packed at the top of their
         * columns.
         */
        alignsATree: () => {
            /** @type {Graph} */
            const tree = {
                nodes: [0, 1, 2, 3, 4, 5, 6].map(id => ({ id, kind: 'a', label: String(id), rank: id === 0 ? 0 : id < 3 ? 1 : 2 })),
                edges: [[0, 1], [0, 2], [1, 3], [1, 4], [2, 5], [2, 6]].map(([from, to]) => ({ from, to, label: '', corner: /** @type {const} */ ('top') })),
            }
            const html = htmlToString(graphSvg(tree))
            /** @type {(x: number, y: number) => boolean} */
            const box = (x, y) => html.includes(`<rect x="${x}" y="${y}" width="50" height="26" rx="4" data-graph-node=""`)
            // The leaves, 40px apart: 26px each and a 14px gap.
            assert([10, 50, 90, 130].every(y => box(190, y)), html)
            // Each parent centred on its leaves: (10 + 76 - 26) / 2.
            assert(box(100, 30) && box(100, 110), html)
            // The root centred on the parents: (30 + 136 - 26) / 2.
            assert(box(10, 70), html)
            assertEq(_crossings(tree), 0)
            assertEq(htmlToString(graphSvg({ ...tree, centerColumns: true })), html)
        },
        /**
         * **A deep tree needs no deep stack.** A chain of 5000 nodes, far
         * deeper than a call stack, is drawn — each node centred on the
         * one after it, so all at one height.
         */
        deepTree: () => {
            const n = 5_000
            const html = htmlToString(graphSvg({
                nodes: Array.from({ length: n }, (_, id) => ({ id, kind: 'a', label: 'x', rank: id })),
                edges: Array.from({ length: n - 1 }, (_, from) => ({ from, to: from + 1, label: '', corner: /** @type {const} */ ('top') })),
            }))
            assertEq(occurrences('y="10" width="50" height="26" rx="4" data-graph-node=""')(html), n)
        },
        /**
         * **Roots stack in id order**, whatever order the graph lists them
         * in, as every column's nodes do.
         */
        rootsInIdOrder: () => {
            const zero = { id: 0, kind: 'a', label: 'zero', rank: 0 }
            const one = { id: 1, kind: 'a', label: 'one', rank: 0 }
            const html = htmlToString(graphSvg({ nodes: [one, zero], edges: [] }))
            assertEq(html, htmlToString(graphSvg({ nodes: [zero, one], edges: [] })))
            assert(html.indexOf('>zero<') < html.indexOf('>one<'), html)
        },
        /**
         * **A node with two parents keeps the columns packed**: it has no
         * one parent to sit beside, so each column stacks from the top, as
         * any graph that is not a tree does.
         */
        sharedNodeStaysPacked: () => {
            const html = htmlToString(graphSvg({
                nodes: [
                    { id: 0, kind: 'a', label: '0', rank: 0 },
                    { id: 1, kind: 'a', label: '1', rank: 1 },
                    { id: 2, kind: 'a', label: '2', rank: 1 },
                    { id: 3, kind: 'a', label: '3', rank: 2 },
                ],
                edges: [[0, 1], [0, 2], [1, 3], [2, 3]].map(([from, to]) => ({ from, to, label: '', corner: /** @type {const} */ ('top') })),
            }))
            assert(html.includes('<rect x="10" y="10" width="50" height="26" rx="4" data-graph-node=""'), html)
            assert(html.includes('<rect x="190" y="10" width="50" height="26" rx="4" data-graph-node=""'), html)
        },
        noEdgeCrossesABox: () => {
            assertEq(_crossings(skipLevel), 0)
            // Two skip-level edges from one source to one target take two
            // lanes, one each, and still cross nothing.
            assertEq(_crossings({
                nodes: [
                    { id: 0, kind: 'a', label: 'root', rank: 0 },
                    { id: 1, kind: 'a', label: 'mid', rank: 1 },
                    { id: 2, kind: 'leaf', label: 'deep', rank: 2 },
                ],
                edges: [
                    { from: 0, to: 2, label: 'a' },
                    { from: 0, to: 1, label: 'b' },
                    { from: 1, to: 2, label: 'c' },
                    { from: 0, to: 2, label: 'd', kind: 'lazy' },
                ],
            }), 0)
        },
        /**
         * **The crossing check itself can tell a crossing from a touch**,
         * or the zero above would say nothing: a line through a box
         * crosses it; one that only starts or ends on its border, or runs
         * beside it, does not.
         */
        crossesBox: () => {
            const box = { id: 0, kind: 'a', label: 'x', rank: 0, x: 10, y: 10, width: 50, height: 26, ports: [] }
            assert(_crossesBox(box)([35, 0])([35, 50])) // straight through
            assert(_crossesBox(box)([0, 0])([70, 50])) // diagonally through
            assert(!_crossesBox(box)([35, 36])([35, 80])) // leaves its bottom border
            assert(!_crossesBox(box)([35, 0])([35, 10])) // ends on its top border
            assert(!_crossesBox(box)([5, 0])([5, 50])) // beside it
            assert(!_crossesBox(box)([0, 0])([70, 0])) // above it
        },
        /**
         * **A marked edge carries its kind to the line, not to the box.**
         * A demo marks an edge its node may never follow; the node is drawn
         * once however many edges reach it, so the mark cannot live there.
         */
        marksAnEdge: () => {
            const html = htmlToString(graphSvg({
                nodes: [
                    { id: 0, kind: 'a', label: 'root', rank: 0 },
                    { id: 1, kind: 'a', label: 'leaf', rank: 1 },
                ],
                edges: [{ from: 0, to: 1, label: 'x', kind: 'lazy' }],
            }))
            assert(html.includes('data-graph-edge-kind="lazy"'), html)
        },
        // An edge a demo does not mark says nothing, rather than saying
        // "ordinary" in an attribute every graph would then carry.
        anUnmarkedEdgeSaysNothing: () => {
            const html = htmlToString(graphSvg({
                nodes: [
                    { id: 0, kind: 'a', label: 'root', rank: 0 },
                    { id: 1, kind: 'a', label: 'leaf', rank: 1 },
                ],
                edges: [{ from: 0, to: 1, label: 'x' }],
            }))
            assert(!html.includes('data-graph-edge-kind'), html)
        },
        /**
         * **Two positions of different kinds stay two marked lines** —
         * `a && a`, both operands one node. Each leaves its own port, so
         * the marked one is marked and the other is not, and neither label
         * is folded into the other.
         */
        keepsKindsApart: () => {
            const html = htmlToString(graphSvg({
                nodes: [
                    { id: 0, kind: 'a', label: 'root', rank: 0 },
                    { id: 1, kind: 'a', label: 'shared', rank: 1 },
                ],
                edges: [
                    { from: 0, to: 1, label: 'left' },
                    { from: 0, to: 1, label: 'right', kind: 'lazy' },
                ],
            }))
            assertEq(occurrences('data-graph-edge=""')(html), 2)
            assertEq(occurrences('data-graph-edge-kind="lazy"')(html), 1)
            assert(!html.includes('>left, right<'), html)
            // Each from a port of its own: two different lines, not one
            // line drawn twice.
            assertEq(new Set(routes(html)).size, 2)
        },
        /**
         * **An edge is its place in the list, not its object.** The same
         * `Edge` object listed twice is two edges, two ports and two
         * lanes. A lane found by object would belong to both, and each
         * route would run across one lane, back and across the other;
         * found by position, each runs across its own — the drawing two
         * separate but equal objects give.
         */
        sharedEdgeObject: () => {
            const nodes = [
                { id: 0, kind: 'a', label: 'root', rank: 0 },
                { id: 1, kind: 'a', label: 'mid', rank: 1 },
                { id: 2, kind: 'leaf', label: 'deep', rank: 2 },
            ]
            const e = { from: 0, to: 2, label: 'e' }
            const middle = [{ from: 0, to: 1, label: 'm' }, { from: 1, to: 2, label: 'x' }]
            const html = htmlToString(graphSvg({ nodes, edges: [e, ...middle, e] }))
            assert(html.includes('d="M74,20 L114,15 L171,15 L211,23"'), html)
            assert(html.includes('d="M74,60 L114,39 L171,39 L211,23"'), html)
            assertEq(html, htmlToString(graphSvg({ nodes, edges: [{ ...e }, ...middle, { ...e }] })))
        },
        /**
         * **The drawing comes in a container of its own**, which the
         * stylesheet scrolls sideways, so a graph wider than the page does
         * not make the whole page scroll.
         */
        inAContainer: () => {
            const html = htmlToString(graphSvg(skipLevel))
            assert(html.includes('<div data-graph=""><svg '), html)
            assert(html.endsWith('</svg></div>'), html)
        },
        /**
         * **Boxes, then edges, then the labels** — the document order
         * an SVG paints in, so a line draws over the border it meets and
         * every label draws over any line. No edge carries a casing: with
         * no box crossed, it would only notch the borders an edge meets.
         */
        layersBoxesThenEdgesThenLabels: () => {
            const html = htmlToString(graphSvg(skipLevel))
            assert(html.lastIndexOf('<rect') < html.indexOf('data-graph-edge=""'), html)
            assert(html.lastIndexOf('data-graph-edge=""') < html.indexOf('data-graph-label'), html)
            // A port's label is text too, and draws over the edges with
            // the node labels.
            assert(html.lastIndexOf('data-graph-edge=""') < html.indexOf('data-graph-edge-label'), html)
            assert(!html.includes('casing'), html)
        },
        /**
         * **An inline value is a cell, not a box.** Its row is the key's
         * cell and, right of it, the value's; no line is drawn and no rank
         * is spent. A value widens the node: the 33px column of `[ ]`, a
         * 24px key and a 61px value are 118px.
         */
        inlineValue: () => {
            const html = htmlToString(graphSvg({
                nodes: [{ id: 0, kind: 'a', label: '[ ]', rank: 0 }],
                edges: [{ from: 0, to: { inline: '"hello"' }, label: '0' }],
            }))
            assert(html.includes('<rect x="10" y="10" width="118" height="20" rx="4" data-graph-node=""'), html)
            assert(html.includes('<rect x="43" y="10" width="24" height="20" data-graph-port="">'), html)
            assert(html.includes('<rect x="67" y="10" width="61" height="20" data-graph-value="">'), html)
            assert(html.includes('<text x="97.5" y="20" text-anchor="middle" data-graph-value-label="">&quot;hello&quot;<'), html)
            assert(!html.includes('data-graph-edge=""'), html)
            assert(html.includes('viewBox="0 0 138 40"'), html)
        },
        /**
         * **Beside an inline value, an edge's key sits in the key
         * column** and its target's label in the value's, and the edge
         * leaves from the row's right side: no cell of the node is empty.
         * `wide`'s keys share one column, 24px, and its value and its
         * edge's target take the rest. **A node keeps its
         * own width**, so `narrow` is 78px in a column whose `wide` is
         * 88px, and its edge runs straight right to the column's edge
         * before it turns rather than cutting across the next column.
         */
        inlineBesideAnEdge: () => {
            /** @type {Graph} */
            const g = {
                nodes: [
                    { id: 0, kind: 'a', label: 'root', rank: 0 },
                    { id: 1, kind: 'a', label: 'wide', rank: 1 },
                    { id: 2, kind: 'a', label: 'narrow', rank: 1 },
                    { id: 3, kind: 'leaf', label: 'x', rank: 2 },
                ],
                edges: [
                    { from: 0, to: 1, label: 'a' },
                    { from: 0, to: 2, label: 'b' },
                    { from: 1, to: { inline: '1' }, label: 'v' },
                    { from: 1, to: 3, label: 'e' },
                    { from: 2, to: 3, label: 'f' },
                ],
            }
            const html = htmlToString(graphSvg(g))
            assert(html.includes('<rect x="114" y="10" width="88" height="40" rx="4" data-graph-node=""'), html)
            assert(html.includes('<rect x="154" y="10" width="24" height="20" data-graph-port="">'), html)
            assert(html.includes('<rect x="178" y="10" width="24" height="20" data-graph-value="">'), html)
            assert(html.includes('<rect x="154" y="30" width="24" height="20" data-graph-port="">'), html)
            assert(html.includes('<rect x="178" y="30" width="24" height="20" data-graph-value="" data-graph-value-ref="">'), html)
            assert(html.includes('<rect x="114" y="64" width="78" height="20" rx="4" data-graph-node=""'), html)
            assert(html.includes('d="M202,40 L242,23"'), html)
            assert(html.includes('d="M192,74 L202,74 L242,23"'), html)
            assertEq(_crossings(g), 0)
        },
        /**
         * **A node's cells round with its corners.** Square cells over a
         * rounded box poked out past its bottom corners; they are clipped
         * to the box's own shape, and its border is drawn again over them
         * so their thinner lines do not show along it. A node with no
         * ports has no cells, and needs neither.
         */
        cellsRoundWithTheNode: () => {
            const html = htmlToString(graphSvg({
                nodes: [
                    { id: 0, kind: 'a', label: 'root', rank: 0 },
                    { id: 1, kind: 'leaf', label: '42', rank: 1 },
                ],
                edges: [{ from: 0, to: 1, label: 'x' }],
            }))
            assert(html.includes('<clipPath id="graph-clip-10-13-64-20"><rect x="10" y="13" width="64" height="20" rx="4">'), html)
            assert(html.includes('<g clip-path="url(#graph-clip-10-13-64-20)"><rect x="50" y="13" width="24" height="20" data-graph-port="">'), html)
            assert(html.includes('</g><rect x="10" y="13" width="64" height="20" rx="4" data-graph-outline="">'), html)
            assertEq(occurrences('<clipPath')(html), 1)
            assertEq(occurrences('data-graph-outline')(html), 1)
        },
        /**
         * **An inline value's kind reaches its cell and its text**, as an
         * attribute of its own; a value with no kind says nothing. The
         * kind is the demo's word, as a node's is — the EDAG demo marks an
         * input `"terminal"` — and the stylesheet decides the look.
         */
        inlineValueKind: () => {
            const html = htmlToString(graphSvg({
                nodes: [{ id: 0, kind: 'a', label: '.', rank: 0 }],
                edges: [
                    { from: 0, to: { inline: 'args', kind: 'terminal' }, label: 'obj' },
                    { from: 0, to: { inline: '1' }, label: 'idx' },
                ],
            }))
            assert(html.includes('data-graph-value="" data-graph-value-kind="terminal">'), html)
            assert(html.includes('data-graph-value-label="" data-graph-value-kind="terminal">args<'), html)
            assert(html.includes('data-graph-value-label="">1<'), html)
            assertEq(occurrences('data-graph-value-kind')(html), 2)
        },
        // A marked edge to an inline value marks its value cell.
        marksAnInlineValue: () => {
            const html = htmlToString(graphSvg({
                nodes: [{ id: 0, kind: 'a', label: '&&', rank: 0 }],
                edges: [{ from: 0, to: { inline: '1' }, label: 'right', kind: 'lazy' }],
            }))
            assert(html.includes('data-graph-value="" data-graph-edge-kind="lazy"'), html)
        },
        /**
         * **An edge that names a node the graph does not have is refused**,
         * at either end. Drawn anyway, one from a missing node had no port
         * to leave from and vanished from a picture that looked complete —
         * a plausible wrong answer where the input was simply wrong.
         */
        throw: {
            fromAMissingNode: () => graphSvg({
                nodes: skipLevel.nodes,
                edges: [...skipLevel.edges, { from: 9, to: 1, label: 'ghost' }],
            }),
            toAMissingNode: () => graphSvg({
                nodes: skipLevel.nodes,
                edges: [...skipLevel.edges, { from: 0, to: 9, label: 'ghost' }],
            }),
            // A value's parts must spell the value its cell is sized by.
            misspeltParts: () => graphSvg({
                nodes: [{ id: 0, kind: 'a', label: 'n', rank: 0 }],
                edges: [{ from: 0, to: { inline: '0101', parts: [['01', 'prior'], ['1', 'current']] }, label: '' }],
            }),
            // An entry, too, must arrive at a node the graph has.
            entryToAMissingNode: () => graphSvg({ nodes: [{ id: 0, kind: 'a', label: 'n', rank: 0 }], edges: [], entries: [{ to: 1 }] }),
            // An edge from a corner has no row for a label or a value.
            labelledCorner: () => graphSvg({
                nodes: [{ id: 0, kind: 'a', label: 'n', rank: 0 }, { id: 1, kind: 'a', label: 'm', rank: 1 }],
                edges: [{ from: 0, to: 1, label: 'left', corner: 'top' }],
            }),
            valueAtACorner: () => graphSvg({
                nodes: [{ id: 0, kind: 'a', label: 'n', rank: 0 }],
                edges: [{ from: 0, to: { inline: '1' }, label: '', corner: 'top' }],
            }),
            // A node's arrows leave from its corners or from its rows: a
            // `middle` corner and the middle of three rows, both to `t`,
            // would be one line.
            cornerBesideARowArrow: () => graphSvg({
                nodes: [{ id: 0, kind: 'a', label: 'n', rank: 0 }, { id: 1, kind: 'a', label: 't', rank: 1 }],
                edges: [
                    { from: 0, to: { inline: '1' }, label: 'a' },
                    { from: 0, to: 1, label: 'b' },
                    { from: 0, to: { inline: '2' }, label: 'c' },
                    { from: 0, to: 1, label: '', corner: 'middle' },
                ],
            }),
            // A node's groups must take its rows: one left over would have
            // no cell beside it,
            rowWithoutAGroup: () => graphSvg({
                nodes: [{ id: 0, kind: 'a', label: 'n', rank: 0, groups: [['a', 1]] }],
                edges: [{ from: 0, to: { inline: '1' }, label: 'k' }, { from: 0, to: { inline: '2' }, label: 'k' }],
            }),
            // and a group with no row would be a cell with no height.
            groupWithoutARow: () => graphSvg({
                nodes: [{ id: 0, kind: 'a', label: 'n', rank: 0, groups: [['a', 0], ['b', 1]] }],
                edges: [{ from: 0, to: { inline: '1' }, label: 'k' }],
            }),
            // And two entries into one node would be drawn as one.
            twoEntriesIntoOneNode: () => graphSvg({ nodes: [{ id: 0, kind: 'a', label: 'n', rank: 0 }], edges: [], entries: [{ to: 0 }, { to: 0, kind: 'old' }] }),
            // The crossing count lays the graph out the same way, and
            // refuses the same input.
            crossings: () => _crossings({
                nodes: skipLevel.nodes,
                edges: [{ from: 9, to: 1, label: 'ghost' }],
            }),
        },
    },
}
