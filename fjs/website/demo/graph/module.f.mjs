/**
 * A node-and-edge diagram, laid out and drawn as SVG — the shared half of
 * any demo whose value is a graph rather than a scalar. A demo turns its own
 * value into {@link Node}s and {@link Edge}s (reference identity decides
 * what is shared, a demo's own business); this module ranks and draws them.
 *
 * **A node's rank is the longest path from the root**, not the first one a
 * walk happens to take: a shared node reached again from a longer route
 * moves down to match, so every edge points down by at least one rank —
 * never sideways, never up. Computed by Bellman-Ford relaxation, stopped the
 * moment a round changes nothing, not a topological sort — simpler for a
 * demo-sized graph, and `nodes.length` rounds is the bound the algorithm
 * needs in its worst case rather than what an ordinary graph costs: a flat
 * row of leaves settles in one round regardless of how many there are, since
 * every one of them depends on the root alone.
 *
 * **Every edge is a quadratic bezier, control point included** — a straight
 * line is just the case where the control point sits on the midpoint. A
 * skip-level edge, a shared node reached again from above an intervening
 * rank, bows instead: reached straight, it would fall on the same vertical
 * as whichever one-rank edge first reached that same node, and read as one
 * line rather than two.
 *
 * @module
 *
 * @import { Edge, Graph, Node, Ranked } from './types.ts'
 * @import { Element } from '../../../media/html/types.ts'
 * @import { _Positioned } from './private.ts'
 */

/**
 * Every node's rank: the longest path from the root, so every edge points
 * down by at least one rank and never sideways or up. A node's id is its
 * index here — a demo's own walk is expected to assign ids `0, 1, 2, …` in
 * creation order with no gaps, root first — so `current[edge.from]` reads a
 * node by id directly.
 *
 * Incoming edges are grouped by target once, not searched for per node on
 * every round: `edges.filter` inside the loop turned this quadratic in the
 * number of rounds a large shared graph took to settle, measured directly on
 * the DataJS demo — a 1500-element document went from 138 ms to 3.9 s under
 * that version.
 *
 * @type {(nodes: readonly Node[], edges: readonly Edge[]) => readonly Ranked[]}
 */
export const ranked = (nodes, edges) => {
    /** @type {readonly (readonly Edge[])[]} */
    const incomingOf = nodes.map(n => edges.filter(e => e.to === n.id))
    let current = nodes.map(n => ({ ...n, rank: n.id === 0 ? 0 : -Infinity }))
    for (let round = 0; round < nodes.length; round++) {
        let changed = false
        current = current.map((node, i) => {
            const best = incomingOf[i].reduce((m, e) => Math.max(m, current[e.from].rank + 1), node.rank)
            if (best === node.rank) { return node }
            changed = true
            return { ...node, rank: best }
        })
        if (!changed) { break }
    }
    return current
}

const nodeHeight = 26
const rowGap = 40
const colGap = 14
const margin = 10
const charWidth = 7

/** @type {(label: string) => number} */
const widthOf = label => Math.max(50, label.length * charWidth + 16)

/**
 * Every node at rank `r`, ordered by id — creation order, not rank order:
 * `ranked` can move a node to a deeper rank than the one it was created at,
 * so id order is not always the order a reader would find the nodes of a
 * rank in if they walked the value themselves. It is still a simple,
 * deterministic left-to-right position, which is what a demo-sized graph
 * needs and no more.
 *
 * @type {(nodes: readonly Ranked[]) => readonly (readonly Ranked[])[]}
 */
const byRank = nodes => {
    const maxRank = nodes.reduce((m, n) => Math.max(m, n.rank), 0)
    return Array.from({ length: maxRank + 1 }, (_, rank) => nodes.filter(n => n.rank === rank))
}

/** @type {(row: readonly Ranked[]) => (y: number) => readonly _Positioned[]} */
const layoutRow = row => y => row.reduce((acc, node) => {
    const width = widthOf(node.label)
    return {
        x: acc.x + width + colGap,
        positioned: [...acc.positioned, { ...node, x: acc.x, y, width, height: nodeHeight }],
    }
}, { x: margin, positioned: /** @type {readonly _Positioned[]} */ ([]) }).positioned

/** @type {(nodes: readonly Ranked[]) => readonly _Positioned[]} */
const layout = nodes => byRank(nodes).flatMap(
    (row, rank) => layoutRow(row)(margin + rank * (nodeHeight + rowGap)))

/**
 * `edges`, with same-pair edges combined into one line. Three array elements
 * sharing one value are three edges with the same `from`/`to` and different
 * labels — drawn separately they land on the same two points and only the
 * last label is ever visible, so they draw as one line labeled with every
 * index or key that reaches it.
 *
 * **Only edges of one kind merge.** An earlier version merged by endpoints
 * alone and dropped a kind the two did not share, which drew `a && a` — both
 * operands one node — as a single solid line labelled `left, right`, saying
 * the conditional operand was not conditional. The positions are what a
 * kind describes, so two positions that differ in one stay two lines;
 * {@link graphSvg} bows them apart, since same-pair lines otherwise land on
 * the same curve.
 *
 * @type {(edges: readonly Edge[]) => readonly Edge[]}
 */
const mergeParallel = edges => edges.reduce((acc, edge) => {
    const at = acc.findIndex(
        e => e.from === edge.from && e.to === edge.to && e.kind === edge.kind)
    return at === -1
        ? [...acc, edge]
        : acc.with(at, { ...acc[at], label: `${acc[at].label}, ${edge.label}` })
}, /** @type {readonly Edge[]} */ ([]))

/**
 * A graph, drawn: a node per {@link Ranked}, an edge per {@link Edge},
 * ranked by longest path from the root.
 *
 * **Three layers, not two: boxes, then edges, then the node labels.** An
 * edge whose rank difference is more than one crosses the ranks between its
 * ends, and a node sitting there is an opaque box — drawn over the edges,
 * as it was while nodes were one layer, it hid about a quarter of every
 * edge that passed under it, on roughly one edge in six of the graphs these
 * demos start with. Edges therefore draw over the boxes. What that order
 * used to protect is the node's own text, so the text moves above the
 * edges and keeps its protection, while the box — a background fill and a
 * border, carrying no information a line can obscure — gives it up.
 *
 * Each edge draws twice, a wide background-coloured casing under the line
 * itself, so a crossing reads as one line passing in front of a box rather
 * than as two strokes meeting at the border. It is the trick the edge
 * labels already use against each other, which `paint-order` does in one
 * element for text and a path needs two elements for.
 *
 * @type {(g: Graph) => Element}
 */
export const graphSvg = g => {
    const positioned = layout(g.nodes)
    const at = /** @type {(id: number) => _Positioned} */ (id => positioned.find(p => p.id === id))
    const width = positioned.reduce((m, p) => Math.max(m, p.x + p.width), 0) + margin
    const height = margin + positioned.reduce((m, p) => Math.max(m, p.y + p.height), 0)
    const merged = mergeParallel(g.edges)
    /** @type {readonly Element[]} */
    const edgeEls = merged.flatMap((edge, i) => {
        // Lines between one pair that did not merge — they differ in kind —
        // would land on the same curve, so each after the first is bowed
        // further out. A pair with one line is untouched, which is every
        // pair a demo that marks nothing can produce.
        const sibling = merged.filter(
            (e, j) => j < i && e.from === edge.from && e.to === edge.to).length
        const from = at(edge.from)
        const to = at(edge.to)
        const x1 = from.x + from.width / 2
        const y1 = from.y + from.height
        const x2 = to.x + to.width / 2
        const y2 = to.y
        const bow = (to.rank - from.rank > 1 ? 24 : 0) + sibling * 20
        const cx = (x1 + x2) / 2 + bow
        const cy = (y1 + y2) / 2
        // Two-thirds of the way to the child, not the midpoint: several
        // edges can fan out from one shared point (an object with two keys
        // naming siblings), and their midpoints sit closer together than
        // their children do. Nearer the child is nearer where the labels
        // have already spread apart.
        const t = 0.65
        const lx = (1 - t) ** 2 * x1 + 2 * (1 - t) * t * cx + t ** 2 * x2
        const ly = (1 - t) ** 2 * y1 + 2 * (1 - t) * t * cy + t ** 2 * y2
        const d = `M${x1},${y1} Q${cx},${cy} ${x2},${y2}`
        return [
            ['path', { d, 'data-graph-edge-casing': '' }],
            ['path', {
                d, 'data-graph-edge': '', 'marker-end': 'url(#graph-arrow)',
                ...(edge.kind === undefined ? {} : { 'data-graph-edge-kind': edge.kind }),
            }],
            ['text', {
                x: String(lx), y: String(ly),
                'text-anchor': 'middle', 'data-graph-edge-label': '',
            }, edge.label],
        ]
    })
    /** @type {readonly Element[]} */
    const boxEls = positioned.map(p => ['rect', {
        x: String(p.x), y: String(p.y), width: String(p.width), height: String(p.height), rx: '4',
        'data-graph-node': '', 'data-graph-kind': p.kind,
    }])
    /** @type {readonly Element[]} */
    const labelEls = positioned.map(p => ['text', {
        x: String(p.x + p.width / 2), y: String(p.y + p.height / 2),
        'text-anchor': 'middle', 'data-graph-label': '',
    }, p.label])
    return ['svg', { viewBox: `0 0 ${width} ${height}`, width: String(width), height: String(height) },
        ['defs',
            ['marker', {
                id: 'graph-arrow', viewBox: '0 0 10 10', refX: '9', refY: '5',
                markerWidth: '6', markerHeight: '6', orient: 'auto',
            },
                ['path', { d: 'M0,0 L10,5 L0,10 z', 'data-graph-arrow': '' }]]],
        ...boxEls,
        ...edgeEls,
        ...labelEls,
    ]
}
