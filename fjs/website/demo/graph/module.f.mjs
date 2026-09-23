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
 * **No edge crosses a box.** Between two neighbouring ranks an edge runs
 * straight across the gap between their rows, where there are no boxes: it
 * leaves the bottom of its port and ends at the top of its target. An edge
 * that skips ranks — a shared node reached again from above an intervening
 * one — is given a **lane** in every row it passes: a narrow slot laid out
 * beside that row's nodes as if it were one, which the edge runs straight
 * down through. Every piece of every edge is then in a gap or in its own
 * lane, so none can pass over a node or its text. It is the layered
 * layout's usual answer, the placeholder nodes Graphviz's `dot` inserts,
 * and why an edge here is a run of straight segments rather than a curve.
 *
 * @module
 *
 * @import { Edge, Graph, Node, Ranked } from './types.ts'
 * @import { Element } from '../../../media/html/types.ts'
 * @import { _Lane, _Point, _Port, _Positioned, _Route, _Slot } from './private.ts'
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
const laneWidth = 10
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
 * The lanes an edge needs: one in every rank strictly between its ends,
 * none for an edge to the next rank. `key` places the lane in its row —
 * just after its source's id, among the nodes ordered by id — so a lane
 * sits near where its edge starts rather than at the far end of a row.
 *
 * @type {(rankOf: (id: number) => number) => (edge: Edge) => readonly _Slot[]}
 */
const lanesOf = rankOf => edge => {
    const from = rankOf(edge.from)
    const span = rankOf(edge.to) - from
    return Array.from({ length: Math.max(0, span - 1) },
        (_, i) => ({ lane: edge, rank: from + 1 + i, key: edge.from + 0.5 }))
}

/**
 * Every row, top to bottom: its nodes and lanes in `key` order, each
 * placed left to right, and the row as tall as its tallest node. A lane
 * spans its row's whole height, so the next row starts below it and below
 * any node's ports alike.
 *
 * A node with outgoing edges is a header and a row of ports beneath it; a
 * node without is the header alone, so a leaf keeps the size it always had.
 *
 * @type {(nodes: readonly Ranked[]) => (edges: readonly Edge[]) => { readonly nodes: readonly _Positioned[], readonly lanes: readonly _Lane[] }}
 */
const layout = nodes => edges => {
    // Keyed by id, not by position: a `Graph` does not promise its nodes
    // in id order, and reading an array built in one order by the other
    // would hang a node's ports on whichever node sat at that index.
    const outgoing = new Map(nodes.map(n => [n.id, edges.filter(e => e.from === n.id)]))
    const outgoingOf = /** @type {(id: number) => readonly Edge[]} */ (id => /** @type {readonly Edge[]} */ (outgoing.get(id)))
    const ranks = new Map(nodes.map(n => [n.id, n.rank]))
    const rankOf = /** @type {(id: number) => number} */ (id => /** @type {number} */ (ranks.get(id)))
    /** @type {readonly _Slot[]} */
    const slots = [
        ...nodes.map(node => ({ node, rank: node.rank, key: node.id })),
        ...edges.flatMap(lanesOf(rankOf)),
    ]
    const maxRank = nodes.reduce((m, n) => Math.max(m, n.rank), 0)
    const rows = Array.from({ length: maxRank + 1 },
        (_, rank) => slots.filter(slot => slot.rank === rank).toSorted((a, b) => a.key - b.key))
    return rows.reduce((acc, row) => {
        const heightOf = /** @type {(slot: _Slot) => number} */ (slot =>
            slot.node === undefined || outgoingOf(slot.node.id).length === 0 ? headerHeight : headerHeight + portHeight)
        const tallest = row.reduce((m, slot) => Math.max(m, heightOf(slot)), 0)
        const placed = row.reduce((r, slot) => {
            if (slot.node === undefined) {
                /** @type {_Lane} */
                const lane = { edge: /** @type {Edge} */ (slot.lane), x: r.x + laneWidth / 2, top: acc.y, bottom: acc.y + tallest }
                return { ...r, x: r.x + laneWidth + colGap, lanes: [...r.lanes, lane] }
            }
            const { width, ports } = portsOf(slot.node.label)(outgoingOf(slot.node.id))
            /** @type {_Positioned} */
            const node = { ...slot.node, x: r.x, y: acc.y, width, height: heightOf(slot), ports }
            return { ...r, x: r.x + width + colGap, nodes: [...r.nodes, node] }
        }, { x: margin, nodes: /** @type {readonly _Positioned[]} */ ([]), lanes: /** @type {readonly _Lane[]} */ ([]) })
        return {
            y: acc.y + tallest + rowGap,
            nodes: [...acc.nodes, ...placed.nodes],
            lanes: [...acc.lanes, ...placed.lanes],
        }
    }, { y: margin, nodes: /** @type {readonly _Positioned[]} */ ([]), lanes: /** @type {readonly _Lane[]} */ ([]) })
}

/**
 * Every edge's route: from the bottom of its port, straight down through
 * each of its lanes, to the top of its target. Lanes are listed a row at a
 * time, top to bottom, so an edge's own lanes come out in the order it
 * passes them.
 *
 * @type {(placed: { readonly nodes: readonly _Positioned[], readonly lanes: readonly _Lane[] }) => readonly _Route[]}
 */
const routesOf = placed => {
    const at = /** @type {(id: number) => _Positioned} */ (id => placed.nodes.find(p => p.id === id))
    return placed.nodes.flatMap(from => from.ports.map(port => {
        const to = at(port.edge.to)
        /** @type {readonly _Point[]} */
        const points = [
            [from.x + port.x + port.width / 2, from.y + from.height],
            ...placed.lanes.filter(lane => lane.edge === port.edge)
                .flatMap(lane => /** @type {readonly _Point[]} */ ([[lane.x, lane.top], [lane.x, lane.bottom]])),
            [to.x + to.width / 2, to.y],
        ]
        return { edge: port.edge, points }
    }))
}

/**
 * Whether a segment passes through the inside of a node's box, its border
 * excluded: an edge that starts on its source's border and ends on its
 * target's touches both and crosses neither. Liang–Barsky clipping of the
 * segment against the box shrunk by half a pixel.
 *
 * Typed by shape rather than by `_Positioned` and `_Point`: it is exported
 * for the proofs, and a private type in an exported signature names a file
 * the published package does not carry.
 *
 * @type {(box: { readonly x: number, readonly y: number, readonly width: number, readonly height: number }) => (a: readonly [number, number]) => (b: readonly [number, number]) => boolean}
 */
export const _crossesBox = box => ([x0, y0]) => ([x1, y1]) => {
    const inset = 0.5
    const dx = x1 - x0
    const dy = y1 - y0
    /** @type {readonly (readonly [number, number])[]} */
    const sides = [
        [-dx, x0 - (box.x + inset)],
        [dx, (box.x + box.width - inset) - x0],
        [-dy, y0 - (box.y + inset)],
        [dy, (box.y + box.height - inset) - y0],
    ]
    const [t0, t1] = sides.reduce(([lo, hi], [p, q]) =>
        p === 0 ? (q < 0 ? [1, 0] : [lo, hi])
            : p < 0 ? [Math.max(lo, q / p), hi]
                : [lo, Math.min(hi, q / p)],
        /** @type {readonly [number, number]} */ ([0, 1]))
    return t0 < t1
}

/**
 * The number of edge segments that pass through a node's box — zero for
 * every graph this module draws, which is the claim {@link graphSvg} makes
 * and the proofs hold it to on each demo's own graphs.
 *
 * @type {(g: Graph) => number}
 */
export const _crossings = g => {
    const placed = layout(g.nodes)(g.edges)
    return routesOf(placed).reduce((n, { points }) =>
        n + points.slice(1).reduce((m, b, i) =>
            m + placed.nodes.filter(box => _crossesBox(box)(points[i])(b)).length, 0), 0)
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
 * **Boxes, then edges, then the labels.** Since no edge crosses a box the
 * order decides only where an edge meets its own ends, and there the line
 * draws over the border it starts or stops on. Edges carry no casing: a
 * background stroke under each line was there to part a line from a box it
 * crossed, and with nothing crossed it would only notch the borders the
 * edges meet and cut gaps into every line another one crosses.
 *
 * @type {(g: Graph) => Element}
 */
export const graphSvg = g => {
    const placed = layout(g.nodes)(g.edges)
    const positioned = placed.nodes
    const width = [
        ...positioned.map(p => p.x + p.width),
        ...placed.lanes.map(lane => lane.x + laneWidth / 2),
    ].reduce((m, x) => Math.max(m, x), 0) + margin
    const height = margin + positioned.reduce((m, p) => Math.max(m, p.y + p.height), 0)
    /** @type {readonly Element[]} */
    const edgeEls = routesOf(placed).map(({ edge, points }) => ['path', {
        d: `M${points.map(([x, y]) => `${x},${y}`).join(' L')}`,
        'data-graph-edge': '', 'marker-end': 'url(#graph-arrow)',
        ...(edge.kind === undefined ? {} : { 'data-graph-edge-kind': edge.kind }),
    }])
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
