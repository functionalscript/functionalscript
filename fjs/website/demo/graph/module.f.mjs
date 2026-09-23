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
 * @import { _Port, _Positioned } from './private.ts'
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

const headerHeight = 26
const portHeight = 20
const rowGap = 40
const colGap = 14
const margin = 10
const charWidth = 7

/** @type {(label: string) => number} */
const widthOf = label => Math.max(50, label.length * charWidth + 16)

/** @type {(label: string) => number} */
const portWidthOf = label => Math.max(24, label.length * charWidth + 12)

/**
 * A node's ports: one cell per outgoing edge, in the order the demo gave
 * the edges, laid side by side across the node's bottom row.
 *
 * **The cells fill the node.** A node is as wide as the wider of its own
 * label and its cells laid end to end; where the label is the wider, the
 * spare width is shared out evenly, so the bottom row is one unbroken
 * strip rather than cells huddled at the left under a long label.
 *
 * @type {(label: string) => (out: readonly Edge[]) => { readonly width: number, readonly ports: readonly _Port[] }}
 */
const portsOf = label => out => {
    const natural = out.map(e => portWidthOf(e.label))
    const total = natural.reduce((a, b) => a + b, 0)
    const width = Math.max(widthOf(label), total)
    const extra = out.length === 0 ? 0 : (width - total) / out.length
    const ports = out.reduce((acc, edge, i) => ({
        x: acc.x + natural[i] + extra,
        ports: [...acc.ports, { edge, x: acc.x, width: natural[i] + extra }],
    }), { x: 0, ports: /** @type {readonly _Port[]} */ ([]) }).ports
    return { width, ports }
}

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

/**
 * One rank's nodes, placed left to right at `y`. A node with outgoing
 * edges is a header and a row of ports beneath it; a node without is the
 * header alone, so a leaf keeps the size it always had.
 *
 * @type {(outgoingOf: readonly (readonly Edge[])[]) => (row: readonly Ranked[]) => (y: number) => readonly _Positioned[]}
 */
const layoutRow = outgoingOf => row => y => row.reduce((acc, node) => {
    const out = outgoingOf[node.id]
    const { width, ports } = portsOf(node.label)(out)
    const height = headerHeight + (out.length === 0 ? 0 : portHeight)
    return {
        x: acc.x + width + colGap,
        positioned: [...acc.positioned, { ...node, x: acc.x, y, width, height, ports }],
    }
}, { x: margin, positioned: /** @type {readonly _Positioned[]} */ ([]) }).positioned

/**
 * Every node placed, a rank to a row. A row is as tall as its tallest
 * node, so the next row starts below the ports of any node in this one.
 *
 * @type {(nodes: readonly Ranked[]) => (edges: readonly Edge[]) => readonly _Positioned[]}
 */
const layout = nodes => edges => {
    const outgoingOf = nodes.map(n => edges.filter(e => e.from === n.id))
    return byRank(nodes).reduce((acc, row) => {
        const placed = layoutRow(outgoingOf)(row)(acc.y)
        const tallest = placed.reduce((m, p) => Math.max(m, p.height), 0)
        return { y: acc.y + tallest + rowGap, positioned: [...acc.positioned, ...placed] }
    }, { y: margin, positioned: /** @type {readonly _Positioned[]} */ ([]) }).positioned
}

/**
 * A graph, drawn: a node per {@link Ranked}, an edge per {@link Edge},
 * ranked by longest path from the root.
 *
 * **Every edge leaves from a port of its own.** A node with outgoing
 * edges draws a row of cells under its label, one per edge, each holding
 * that edge's label, and the edge starts at the bottom of its cell. Drawn
 * from one shared point, several edges fanned out of a node's bottom edge
 * with their labels floating over the lines, and two edges to one node —
 * `[a, a]`, or `a && a` — landed on one curve and had to be merged or bowed
 * apart. From a cell each, no two edges share a start, a label always sits
 * in the box it names, and nothing has to be merged.
 *
 * **Three layers, not two: boxes, then edges, then the labels.** An
 * edge whose rank difference is more than one crosses the ranks between its
 * ends, and a node sitting there is an opaque box — drawn over the edges,
 * as it was while nodes were one layer, it hid about a quarter of every
 * edge that passed under it, on roughly one edge in six of the graphs these
 * demos start with. Edges therefore draw over the boxes. What that order
 * used to protect is the text, so node and port labels move above the
 * edges and keep their protection, while the boxes — a background fill and
 * a border, carrying no information a line can obscure — give it up.
 *
 * Each edge draws twice, a wide background-coloured casing under the line
 * itself, so a crossing reads as one line passing in front of a box rather
 * than as two strokes meeting at the border.
 *
 * @type {(g: Graph) => Element}
 */
export const graphSvg = g => {
    const positioned = layout(g.nodes)(g.edges)
    const at = /** @type {(id: number) => _Positioned} */ (id => positioned.find(p => p.id === id))
    const width = positioned.reduce((m, p) => Math.max(m, p.x + p.width), 0) + margin
    const height = margin + positioned.reduce((m, p) => Math.max(m, p.y + p.height), 0)
    /** @type {readonly Element[]} */
    const edgeEls = positioned.flatMap(from => from.ports.flatMap(port => {
        const edge = port.edge
        const to = at(edge.to)
        const x1 = from.x + port.x + port.width / 2
        const y1 = from.y + from.height
        const x2 = to.x + to.width / 2
        const y2 = to.y
        const bow = to.rank - from.rank > 1 ? 24 : 0
        const cx = (x1 + x2) / 2 + bow
        const cy = (y1 + y2) / 2
        const d = `M${x1},${y1} Q${cx},${cy} ${x2},${y2}`
        return /** @type {readonly Element[]} */ ([
            ['path', { d, 'data-graph-edge-casing': '' }],
            ['path', {
                d, 'data-graph-edge': '', 'marker-end': 'url(#graph-arrow)',
                ...(edge.kind === undefined ? {} : { 'data-graph-edge-kind': edge.kind }),
            }],
        ])
    }))
    /** @type {readonly Element[]} */
    const boxEls = positioned.flatMap(p => [
        /** @type {Element} */ (['rect', {
            x: String(p.x), y: String(p.y), width: String(p.width), height: String(p.height), rx: '4',
            'data-graph-node': '', 'data-graph-kind': p.kind,
        }]),
        ...p.ports.map(port => /** @type {Element} */ (['rect', {
            x: String(p.x + port.x), y: String(p.y + headerHeight),
            width: String(port.width), height: String(portHeight),
            'data-graph-port': '',
        }])),
    ])
    /** @type {readonly Element[]} */
    const labelEls = positioned.flatMap(p => [
        /** @type {Element} */ (['text', {
            x: String(p.x + p.width / 2), y: String(p.y + headerHeight / 2),
            'text-anchor': 'middle', 'data-graph-label': '',
        }, p.label]),
        ...p.ports.map(port => /** @type {Element} */ (['text', {
            x: String(p.x + port.x + port.width / 2), y: String(p.y + headerHeight + portHeight / 2),
            'text-anchor': 'middle', 'data-graph-edge-label': '',
        }, port.edge.label])),
    ])
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
