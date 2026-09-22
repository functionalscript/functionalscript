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
        // Two edges with the same endpoints draw as one line, merged labels —
        // drawn separately, the second would land exactly on the first and
        // hide it.
        mergesParallelEdges: () => {
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
            assertEq(html.split('data-graph-edge=""').length - 1, 1)
            assert(html.includes('>a, b<'), html)
        },
        /**
         * **A skip-level edge bows; a one-rank edge stays straight** —
         * asserted by the exact control point, since the layout is pure
         * arithmetic over the input. Three single-node rows at 50px wide
         * center every node at x=35; y is `margin + rank*(nodeHeight+rowGap)`
         * = 10, 76, 142.
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
            assert(html.includes('d="M35,36 Q59,89 35,142"'), html) // r: rank diff 2, bows
            assert(html.includes('d="M35,36 Q35,56 35,76"'), html) // p: rank diff 1, straight
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
         * **Merging keeps a kind only where every edge merged had it.** Two
         * references to one node, one marked and one not, are a single line
         * that cannot be both — and the unmarked reading holds, since a lazy
         * operand says a node *may* go unevaluated, which an eager reference
         * from the same place already answers.
         */
        mergingDropsAKindThatDiffers: () => {
            const nodes = [
                { id: 0, kind: 'a', label: 'root', rank: 0 },
                { id: 1, kind: 'a', label: 'shared', rank: 1 },
            ]
            const both = htmlToString(graphSvg({
                nodes,
                edges: [
                    { from: 0, to: 1, label: 'a', kind: 'lazy' },
                    { from: 0, to: 1, label: 'b' },
                ],
            }))
            assert(!both.includes('data-graph-edge-kind'), both)
            assert(both.includes('>a, b<'), both)
            // Both marked, and the one line keeps the mark.
            const alike = htmlToString(graphSvg({
                nodes,
                edges: [
                    { from: 0, to: 1, label: 'a', kind: 'lazy' },
                    { from: 0, to: 1, label: 'b', kind: 'lazy' },
                ],
            }))
            assert(alike.includes('data-graph-edge-kind="lazy"'), alike)
        },
        /**
         * **Boxes, then edges, then the node labels** — the document order
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
            assert(html.includes('d="M35,36 Q59,89 35,142" data-graph-edge-casing'), html)
        },
    },
}
