/**
 * @import { Graph, Shape } from './types.ts'
 */

import { _crossesBox, _crossings, graphOf, ranked, graphSvg } from './module.f.mjs'
import { htmlToString } from '../../../media/html/module.f.mjs'
import { assert, assertEq, assertStructurallySame } from '../../../asserts/module.f.mjs'

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
        },
        // A value reached again from outside the node it is under is shared,
        // not a cycle: `0` reaches `1` directly and through `2`.
        sharedIsNotACycle: () => {
            const g = graphOf(/** @type {(v: number) => Shape<number>} */ (
                v => ({ kind: 'n', label: `${v}`, children: v === 0 ? [['a', 1], ['b', 2]] : v === 2 ? [['c', 1]] : [] })))(0)
            assertStructurallySame(g.nodes.map(n => n.rank), [0, 2, 1])
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
    },
    graphSvg: {
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
            assertEq(html.split('<g data-graph-in-kind="container">').length - 1, 2)
            assertEq(html.split('<g data-graph-in-kind="leaf">').length - 1, 2)
            assert(html.includes('<g data-graph-in-kind="container"><text'), html)
        },
        // An entry is an arrow from nowhere into a node, level with where
        // an edge would arrive. The first column moves right by an arrow's
        // length to make room: the first node is at x=34, and its header's
        // middle, y=23, is where its arrow arrives. A node with no entry
        // gets no arrow.
        entries: () => {
            const html = htmlToString(graphSvg({
                nodes: [{ id: 0, kind: 'a', label: 'n', rank: 0 }, { id: 1, kind: 'a', label: 'm', rank: 0 }],
                edges: [],
                entries: [{ to: 0, kind: 'old' }],
            }))
            assert(html.includes('<rect x="34" y="10" width="50" height="26" rx="4" data-graph-node=""'), html)
            assert(html.includes('<path d="M10,23 L34,23" data-graph-edge="" data-graph-entry="" marker-end="url(#graph-arrow)" data-graph-edge-kind="old">'), html)
            assertEq(html.split('data-graph-entry=""').length - 1, 1)
        },
        // An edge with a corner takes no row: the node is its 26px title
        // and one 20px value row, 46px tall, and its three edges leave its
        // right side, x=60, from the top corner, the middle and the bottom
        // corner. It is a tree, so the node is centred on its three
        // children, 10 to 116: at y=40, its middle edge level with the
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
            assert(html.includes('<rect x="10" y="40" width="50" height="46" rx="4" data-graph-node=""'), html)
            assertEq(html.split('data-graph-port=""').length - 1, 0)
            const starts = routes(html).map(d => d.split(' ')[0])
            assertEq(JSON.stringify(starts), '["M60,40","M60,63","M60,86"]')
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
        // An empty label is no row when a node has ports: each node is its
        // one 20px row, and the edge runs from the middle of the first row
        // to the middle of the second's. A node with no ports keeps its
        // 26px header, or it would have no height. The root's two rows are
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
            assertEq(html.split('data-graph-port=""').length - 1, 1)
            assert(html.includes('<rect x="34" y="30" width="26" height="20" data-graph-value="">'), html)
        },
        /**
         * **An edge's label sits in a port of its own node**, not on the
         * line: the node is a header over a row per outgoing edge, and the
         * edge leaves from the right end of its row. Pinned by the exact
         * geometry — a 50px node at (10,10), a 26px header over a 20px
         * row, so the row's label is centred at y=46 and the line starts
         * at the node's right side, x=60, and ends at the left of the
         * next column's node, level with its label. The root is taller
         * than its one child, so the child moves down to be centred on it,
         * at y=20, and the line ends at (100,33).
         */
        labelInAPort: () => {
            const html = htmlToString(graphSvg({
                nodes: [
                    { id: 0, kind: 'a', label: 'root', rank: 0 },
                    { id: 1, kind: 'leaf', label: '42', rank: 1 },
                ],
                edges: [{ from: 0, to: 1, label: 'x' }],
            }))
            assert(html.includes('<rect x="10" y="10" width="50" height="46" rx="4" data-graph-node=""'), html)
            assert(html.includes('<rect x="10" y="36" width="50" height="20" data-graph-port="">'), html)
            assert(html.includes('<text x="35" y="46" text-anchor="middle" data-graph-edge-label="">x<'), html)
            assert(html.includes('d="M60,46 L100,33"'), html)
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
            assert(html.includes('<rect x="10" y="36" width="50" height="20" data-graph-port="">'), html)
            assert(html.includes('d="M60,46 L100,33"'), html)
            assertEq(html, htmlToString(graphSvg({ nodes: [root, child], edges })))
            assertEq(
                htmlToString(graphSvg({ ...skipLevel, nodes: skipLevel.nodes.toReversed() })),
                htmlToString(graphSvg(skipLevel)))
        },
        // A node with no outgoing edge has no ports, and keeps the header's
        // height alone — a leaf is the size it always was.
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
            assertEq(html.split('data-graph-port=""').length - 1, 2)
            assertEq(html.split('data-graph-edge=""').length - 1, 2)
            assert(html.includes('data-graph-edge-label="">a<'), html)
            assert(html.includes('data-graph-edge-label="">b<'), html)
            assert(!html.includes('>a, b<'), html)
            // Each from the middle of its own 20px row.
            assert(html.includes('d="M60,46 '), html)
            assert(html.includes('d="M60,66 '), html)
        },
        /**
         * **A node is as wide as its label or its widest key, whichever
         * is wider**, and as tall as its rows. Six nine-letter keys at
         * 7px a letter outgrow a 50px label: 82px wide, six 20px rows
         * under the 26px header, each key filling its row.
         */
        portsWidenTheNode: () => {
            const html = htmlToString(graphSvg({
                nodes: [
                    { id: 0, kind: 'a', label: '[]', rank: 0 },
                    { id: 1, kind: 'leaf', label: '1', rank: 1 },
                ],
                edges: [0, 1, 2, 3, 4, 5].map(i => ({ from: 0, to: 1, label: `longlabel${i}` })),
            }))
            assert(html.includes('<rect x="10" y="10" width="82" height="146"'), html)
            assert(html.includes('<rect x="10" y="136" width="82" height="20" data-graph-port="">'), html)
        },
        /**
         * **An edge that skips a rank runs across a lane of its own** —
         * asserted by the exact route, since the layout is pure arithmetic
         * over the input. `r` skips rank 1, so that column gets a 10px
         * lane placed just after `r`'s source, ahead of the node there:
         * centred at y=15, and the node moves down to y=34. The column is
         * 50px wide, so the lane spans x=100 to 150 and `r` runs straight
         * across it; `p` and `y`, one rank each, are single segments
         * across a gap.
         */
        laneForASkipLevelEdge: () => {
            const html = htmlToString(graphSvg(skipLevel))
            assert(html.includes('d="M60,66 L100,15 L150,15 L190,23"'), html) // r: through its lane
            assert(html.includes('d="M60,46 L100,47"'), html) // p: one rank, one segment
            assert(html.includes('d="M150,70 L190,23"'), html) // y: one rank, one segment
            assert(html.includes('<rect x="100" y="34" width="50" height="46"'), html)
            // The lane is part of the drawing's height, not just the nodes.
            assert(html.includes('viewBox="0 0 250 90"'), html)
        },
        /**
         * **No edge crosses a box** — the claim the lanes exist for,
         * counted rather than eyeballed. A lane-less layout drew `r` from
         * the root straight to rank 2, through the node on rank 1.
         */
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
            assertEq(html.split('data-graph-edge=""').length - 1, 2)
            assertEq(html.split('data-graph-edge-kind="lazy"').length - 1, 1)
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
            assert(html.includes('d="M60,46 L100,15 L150,15 L190,23"'), html)
            assert(html.includes('d="M60,86 L100,39 L150,39 L190,23"'), html)
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
         * is spent. A value wider than the node's label widens the node:
         * a 24px key beside a 61px value is 85px.
         */
        inlineValue: () => {
            const html = htmlToString(graphSvg({
                nodes: [{ id: 0, kind: 'a', label: '[ ]', rank: 0 }],
                edges: [{ from: 0, to: { inline: '"hello"' }, label: '0' }],
            }))
            assert(html.includes('<rect x="10" y="10" width="85" height="46" rx="4" data-graph-node=""'), html)
            assert(html.includes('<rect x="10" y="36" width="24" height="20" data-graph-port="">'), html)
            assert(html.includes('<rect x="34" y="36" width="61" height="20" data-graph-value="">'), html)
            assert(html.includes('<text x="64.5" y="46" text-anchor="middle" data-graph-value-label="">&quot;hello&quot;<'), html)
            assert(!html.includes('data-graph-edge=""'), html)
            assert(html.includes('viewBox="0 0 105 66"'), html)
        },
        /**
         * **Beside an inline value, an edge's key fills its row**, as wide
         * as the node, and the edge leaves from the node's right side: no
         * cell of the node is empty. `wide`'s keys share one column, 24px,
         * and its value takes the rest. **A node keeps its own width**, so
         * `wide` is 50px in a column whose `narrow` is 58px, and its edge
         * runs straight right to the column's edge before it turns rather
         * than cutting across `narrow`.
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
            assert(html.includes('<rect x="100" y="10" width="50" height="66" rx="4" data-graph-node=""'), html)
            assert(html.includes('<rect x="100" y="36" width="24" height="20" data-graph-port="">'), html)
            assert(html.includes('<rect x="124" y="36" width="26" height="20" data-graph-value="">'), html)
            assert(html.includes('<rect x="100" y="56" width="50" height="20" data-graph-port="">'), html)
            assert(html.includes('<rect x="100" y="90" width="58" height="46" rx="4" data-graph-node=""'), html)
            assert(html.includes('d="M150,66 L158,66 L198,23"'), html)
            assert(html.includes('d="M158,126 L198,23"'), html)
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
            assert(html.includes('<clipPath id="graph-clip-10-10-50-46"><rect x="10" y="10" width="50" height="46" rx="4">'), html)
            assert(html.includes('<g clip-path="url(#graph-clip-10-10-50-46)"><rect x="10" y="36" width="50" height="20" data-graph-port="">'), html)
            assert(html.includes('</g><rect x="10" y="10" width="50" height="46" rx="4" data-graph-outline="">'), html)
            assertEq(html.split('<clipPath').length - 1, 1)
            assertEq(html.split('data-graph-outline').length - 1, 1)
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
            assertEq(html.split('data-graph-value-kind').length - 1, 2)
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
