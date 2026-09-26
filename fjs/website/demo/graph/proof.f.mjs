/**
 * @import { Graph } from './types.ts'
 */

import { _crossesBox, _crossings, ranked, graphSvg } from './module.f.mjs'
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
            assert(html.includes('d="M35,56 L35,96"'), html)
        },
        /**
         * **Nodes are found by id, not by position.** A `Graph` does not
         * promise its nodes in id order. Given the child first, the port
         * still hangs on the root and the edge still points down from it;
         * given the skip-level graph backwards, `r` still gets its lane.
         * Either way the drawing is the one the id-ordered graph draws.
         */
        nodesOutOfIdOrder: () => {
            const edges = [{ from: 0, to: 1, label: 'x' }]
            const root = { id: 0, kind: 'a', label: 'root', rank: 0 }
            const child = { id: 1, kind: 'leaf', label: '42', rank: 1 }
            const html = htmlToString(graphSvg({ nodes: [child, root], edges }))
            assert(html.includes('<rect x="10" y="36" width="50" height="20" data-graph-port="">'), html)
            assert(html.includes('d="M35,56 L35,96"'), html)
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
         * **An edge that skips a rank runs down a lane of its own** —
         * asserted by the exact route, since the layout is pure arithmetic
         * over the input. `r` skips rank 1, so that row gets a 10px lane
         * placed just after `r`'s source, centred at x=15, and the node
         * there moves right to x=34. The row is 46px tall, so the lane
         * spans y=96 to 142 and `r` runs straight down it; `p` and `y`,
         * one rank each, are single segments across a gap.
         */
        laneForASkipLevelEdge: () => {
            const html = htmlToString(graphSvg(skipLevel))
            assert(html.includes('d="M47.5,56 L15,96 L15,142 L35,182"'), html) // r: through its lane
            assert(html.includes('d="M22.5,56 L59,96"'), html) // p: one rank, one segment
            assert(html.includes('d="M59,142 L35,182"'), html) // y: one rank, one segment
            assert(html.includes('<rect x="34" y="96" width="50" height="46"'), html)
            // The lane is part of the drawing's width, not just the nodes.
            assert(html.includes('viewBox="0 0 94 218"'), html)
        },
        /**
         * **No edge crosses a box** — the claim the lanes exist for,
         * counted rather than eyeballed. A lane-less layout drew `r` from
         * the root straight to rank 2, through the node on rank 1.
         */
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
         * route would run down one lane, back up and down the other; found
         * by position, each runs down its own — the drawing two separate
         * but equal objects give.
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
            assert(html.includes('d="M22,56 L15,96 L15,142 L35,182"'), html)
            assert(html.includes('d="M70,56 L39,96 L39,142 L35,182"'), html)
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
         * **An inline value is a cell, not a box.** Its port grows a 20px
         * cell under the label, holding the value, and the node a row to
         * match; no line is drawn and no rank is spent. A value wider
         * than its label widens its port.
         */
        inlineValue: () => {
            const html = htmlToString(graphSvg({
                nodes: [{ id: 0, kind: 'a', label: '[ ]', rank: 0 }],
                edges: [{ from: 0, to: { inline: '"hello"' }, label: '0' }],
            }))
            assert(html.includes('<rect x="10" y="10" width="61" height="66" rx="4" data-graph-node=""'), html)
            assert(html.includes('<rect x="10" y="36" width="61" height="20" data-graph-port="">'), html)
            assert(html.includes('<rect x="10" y="56" width="61" height="20" data-graph-value="">'), html)
            assert(html.includes('<text x="40.5" y="66" text-anchor="middle" data-graph-value-label="">&quot;hello&quot;<'), html)
            assert(!html.includes('data-graph-edge=""'), html)
            assert(html.includes('viewBox="0 0 81 86"'), html)
        },
        /**
         * **Beside an inline value, an edge's port fills both rows**, its
         * key centred in it, and the edge leaves from the node's bottom:
         * no cell of the node is empty. **A node keeps its own height**,
         * so `narrow`, with no value, is 46px in a row whose `wide` is
         * 66px, and its edge drops straight to the row's bottom before it
         * turns rather than cutting across `wide`'s lower part.
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
            assert(html.includes('<rect x="10" y="96" width="50" height="66" rx="4" data-graph-node=""'), html)
            assert(html.includes('<rect x="10" y="122" width="25" height="20" data-graph-port="">'), html)
            assert(html.includes('<rect x="35" y="122" width="25" height="40" data-graph-port="">'), html)
            assert(html.includes('<text x="47.5" y="142" text-anchor="middle" data-graph-edge-label="">e<'), html)
            assert(html.includes('d="M47.5,162 L35,202"'), html)
            assert(html.includes('<rect x="74" y="96" width="58" height="46" rx="4" data-graph-node=""'), html)
            assert(html.includes('d="M103,142 L103,162 L35,202"'), html)
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
            // The crossing count lays the graph out the same way, and
            // refuses the same input.
            crossings: () => _crossings({
                nodes: skipLevel.nodes,
                edges: [{ from: 9, to: 1, label: 'ghost' }],
            }),
        },
    },
}
