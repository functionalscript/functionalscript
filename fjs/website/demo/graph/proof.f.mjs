import { ranked, graphSvg } from './module.f.mjs'
import { htmlToString } from '../../../media/html/module.f.mjs'
import { assert, assertEq, assertStructurallySame } from '../../../asserts/module.f.mjs'

export const proof = {
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
        },
        /**
         * **An edge's label sits in a port of its own node**, not on the
         * line: the node is a header over a row of cells, one per outgoing
         * edge, and the edge leaves from the bottom of its cell. Pinned by
         * the exact geometry — a 50px node at (10,10), a 26px header over a
         * 20px port, so the port's label is centred at y=46 and the line
         * starts at the node's bottom, y=56.
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
            assert(html.includes('d="M35,56 Q35,76 35,96"'), html)
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
         * `a, b`; from a cell each, they start apart and need nothing.
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
            // Each from the middle of its own 25px cell.
            assert(html.includes('d="M22.5,56 '), html)
            assert(html.includes('d="M47.5,56 '), html)
        },
        /**
         * **A node is as wide as its label or its ports, whichever is
         * wider.** Six one-digit ports at their 24px minimum outgrow a
         * 50px label; the cells lie end to end from the node's left edge.
         */
        portsWidenTheNode: () => {
            const html = htmlToString(graphSvg({
                nodes: [
                    { id: 0, kind: 'a', label: '[]', rank: 0 },
                    { id: 1, kind: 'leaf', label: '1', rank: 1 },
                ],
                edges: [0, 1, 2, 3, 4, 5].map(i => ({ from: 0, to: 1, label: `${i}` })),
            }))
            assert(html.includes('<rect x="10" y="10" width="144" height="46"'), html)
            assert(html.includes('<rect x="130" y="36" width="24" height="20" data-graph-port="">'), html)
        },
        /**
         * **A skip-level edge bows; a one-rank edge runs straight to its
         * target** — asserted by the exact control point, since the layout
         * is pure arithmetic over the input. The root's two ports are 25px
         * cells centred at x=22.5 and 47.5; every node's top centre is at
         * x=35. A row is as tall as its tallest node, so the rows start at
         * y=10, 96 and 182 — a 46px node with ports, then a 40px gap.
         */
        bowsASkipLevelEdge: () => {
            const html = htmlToString(graphSvg({
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
            }))
            assert(html.includes('d="M47.5,56 Q65.25,119 35,182"'), html) // r: rank diff 2, bows
            assert(html.includes('d="M22.5,56 Q28.75,76 35,96"'), html) // p: rank diff 1, no bow
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
        },
        /**
         * **Boxes, then edges, then the labels** — the document order
         * an SVG paints in. The same three ranks as above: `r` skips rank 1,
         * so it crosses that row, and the node there hid a quarter of it
         * while the boxes drew last. The labels still draw after the edges,
         * which is what the old order was protecting.
         *
         * Each edge is cased, and the casing carries its line's own curve —
         * a casing on a straight path under a bowed one would leave the bow
         * uncased, which is the half that crosses anything.
         */
        layersBoxesThenEdgesThenLabels: () => {
            const html = htmlToString(graphSvg({
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
            }))
            assert(html.indexOf('<rect') < html.indexOf('data-graph-edge-casing'), html)
            assert(html.indexOf('data-graph-edge-casing') < html.indexOf('data-graph-label'), html)
            assertEq(html.split('data-graph-edge-casing').length - 1, 3)
            assert(html.includes('d="M47.5,56 Q65.25,119 35,182" data-graph-edge-casing'), html)
            // A port's label is text too, and draws over the edges with
            // the node labels.
            assert(html.lastIndexOf('data-graph-edge-casing') < html.indexOf('data-graph-edge-label'), html)
        },
    },
}
