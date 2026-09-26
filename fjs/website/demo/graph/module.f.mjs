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
 * **A primitive draws inside the node that holds it.** An edge whose `to`
 * is an {@link Inline} value leaves no line: its port grows a second cell,
 * under the edge's label, holding the value. A number or a `null` has no
 * identity to share, so a box of its own, a line and an arrow would only
 * spend a rank and a lane saying what one cell says.
 *
 * @module
 *
 * @import { Edge, Graph, Inline, Node, Ranked } from './types.ts'
 * @import { Element } from '../../../media/html/types.ts'
 * @import { _Lane, _Out, _Placed, _Point, _Port, _Positioned, _Route, _Slot } from './private.ts'
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

const headerHeight = /** @type {const} */ (26)
const portHeight = /** @type {const} */ (20)
const valueHeight = /** @type {const} */ (20)
const rowGap = /** @type {const} */ (40)
const colGap = /** @type {const} */ (14)
const laneWidth = /** @type {const} */ (10)
const margin = /** @type {const} */ (10)
const charWidth = /** @type {const} */ (7)

/** @type {(label: string) => number} */
const widthOf = label => Math.max(50, label.length * charWidth + 16)

/** @type {(label: string) => number} */
const portWidthOf = label => Math.max(24, label.length * charWidth + 12)

/** @type {(edge: Edge) => string | null} */
const inlineOf = ({ to }) => typeof to === 'number' ? null : to.inline

/**
 * The attribute an inline value's kind draws with, on its cell and its
 * text alike, or none for a value with no kind. It is an attribute of its
 * own rather than `data-graph-kind`, which the stylesheet reads for a
 * node's box: a value's text is not a box, and a rule that fills a
 * terminal box would fill its text too.
 *
 * @type {(edge: Edge) => { readonly 'data-graph-value-kind'?: string }}
 */
const valueKindOf = ({ to }) =>
    typeof to === 'number' || to.kind === undefined ? {} : { 'data-graph-value-kind': to.kind }

/**
 * A node's ports: one cell per outgoing edge, in the order the demo gave
 * the edges, laid side by side across the node's bottom row.
 *
 * **The cells fill the node.** A node is as wide as the wider of its own
 * label and its cells laid end to end; where the label is the wider, the
 * spare width is shared out evenly, so the bottom row is one unbroken
 * strip rather than cells huddled at the left under a long label.
 *
 * @type {(label: string) => (out: readonly _Out[]) => { readonly width: number, readonly ports: readonly _Port[] }}
 */
const portsOf = label => out => {
    const natural = out.map(({ edge }) => {
        const inline = inlineOf(edge)
        return Math.max(portWidthOf(edge.label), inline === null ? 0 : portWidthOf(inline))
    })
    const total = natural.reduce((a, b) => a + b, 0)
    const width = Math.max(widthOf(label), total)
    const extra = out.length === 0 ? 0 : (width - total) / out.length
    const ports = out.reduce((acc, { edge, index }, i) => ({
        x: acc.x + natural[i] + extra,
        ports: [...acc.ports, { edge, index, x: acc.x, width: natural[i] + extra }],
    }), { x: 0, ports: /** @type {readonly _Port[]} */ ([]) }).ports
    return { width, ports }
}

/**
 * What is wrong with one edge's ends, if anything: each end must name a
 * node of the graph.
 *
 * @type {(ids: ReadonlySet<number>) => (edge: Edge, index: number) => readonly string[]}
 */
const missingEnds = ids => (edge, index) => [
    ...(ids.has(edge.from) ? [] : [`edge ${index} ("${edge.label}") starts at node ${edge.from}, which is not in the graph`]),
    ...(typeof edge.to !== 'number' || ids.has(edge.to) ? [] : [`edge ${index} ("${edge.label}") ends at node ${edge.to}, which is not in the graph`]),
]

/**
 * Every row, top to bottom: its nodes and lanes in `key` order, each
 * placed left to right, and the row as tall as its tallest node. A lane
 * spans its row's whole height, so the next row starts below it and below
 * any node's ports alike.
 *
 * A node with outgoing edges is a header and a row of ports beneath it; a
 * node without is the header alone, so a leaf keeps the size it always had.
 * A node with an inline value adds a row for the values under the ports:
 * an inline port is its label over its value, and an edge's port fills
 * both rows, its label centred in it, so no cell of the node is empty.
 *
 * **A node is as tall as its own content**, not as its row: a node with
 * no inline value in a row with one would otherwise carry a row of empty
 * cells. Its edges drop straight down to the row's bottom before they
 * turn — see {@link routesOf}.
 *
 * **An edge has a lane in every rank strictly between its ends**, and none
 * when it goes to the next rank, or to an inline value, which has no
 * rank. A lane's `key` places it just after its source's id, among the
 * nodes ordered by id, so it sits near where its edge starts rather than
 * at the far end of a row. It carries its edge's
 * `index`, its position in the graph's list, because that is what tells
 * two edges apart: the same `Edge` object may be listed twice, and a lane
 * found by object would belong to both.
 *
 * **Nothing here scans more than it has to.** Lanes are the one part of
 * the drawing that grows faster than the graph — a root reaching every
 * node of an `n`-long chain needs about `n²/2` of them — so a row's lanes
 * are read off each edge's span of ranks rather than filtered out of every
 * lane there is, and a row is placed with a running `x` rather than by
 * copying what it has placed so far at every step. Built the obvious way,
 * both were quadratic in the lanes; a 300-node chain of that shape took
 * five times as long as the drawing had before lanes existed.
 *
 * @type {(nodes: readonly Ranked[]) => (edges: readonly Edge[]) => _Placed}
 */
const layout = nodes => edges => {
    // **An edge must name nodes the graph has, or the graph is refused.**
    // An edge is drawn from a port of its source, so one whose source is
    // missing would have nowhere to leave from and would simply vanish,
    // leaving a picture that looks complete — a plausible wrong answer
    // for input that is wrong.
    const problems = edges.flatMap(missingEnds(new Set(nodes.map(n => n.id))))
    if (problems.length !== 0) { throw `graph: ${problems[0]}` }
    // Keyed by id, not by position: a `Graph` does not promise its nodes
    // in id order, and reading an array built in one order by the other
    // would hang a node's ports on whichever node sat at that index.
    // Each edge travels with its index, which is what names it from here
    // on: the same object may be listed twice and is then two edges.
    const outgoing = new Map(nodes.map(n => [n.id,
        edges.flatMap((edge, index) => edge.from === n.id ? [{ edge, index }] : [])]))
    const outgoingOf = /** @type {(id: number) => readonly _Out[]} */ (id => /** @type {readonly _Out[]} */ (outgoing.get(id)))
    const ranks = new Map(nodes.map(n => [n.id, n.rank]))
    const rankOf = /** @type {(id: number) => number} */ (id => /** @type {number} */ (ranks.get(id)))
    const spans = edges.map(({ from, to }) =>
        ({ from: rankOf(from), to: typeof to === 'number' ? rankOf(to) : rankOf(from), key: from + 0.5 }))
    const maxRank = nodes.reduce((m, n) => Math.max(m, n.rank), 0)
    /** @type {readonly (readonly _Slot[])[]} */
    const rows = Array.from({ length: maxRank + 1 }, (_, rank) => [
        ...nodes.filter(node => node.rank === rank).map(node => ({ node, rank, key: node.id })),
        ...spans.flatMap((span, lane) => span.from < rank && rank < span.to ? [{ lane, rank, key: span.key }] : []),
    ].toSorted((a, b) => a.key - b.key))
    const heightOf = /** @type {(slot: _Slot) => number} */ (slot => {
        const out = slot.node === undefined ? [] : outgoingOf(slot.node.id)
        return out.length === 0 ? headerHeight
            : out.some(({ edge }) => inlineOf(edge) !== null) ? headerHeight + portHeight + valueHeight
                : headerHeight + portHeight
    })
    let y = margin
    const placedRows = rows.map(row => {
        const top = y
        const tallest = row.reduce((m, slot) => Math.max(m, heightOf(slot)), 0)
        y += tallest + rowGap
        let x = margin
        const slots = row.map(slot => {
            const left = x
            if (slot.node === undefined) {
                x += laneWidth + colGap
                /** @type {_Lane} */
                const lane = { index: /** @type {number} */ (slot.lane), rank: slot.rank, x: left + laneWidth / 2, top, bottom: top + tallest }
                return { lane }
            }
            const { width, ports } = portsOf(slot.node.label)(outgoingOf(slot.node.id))
            x += width + colGap
            /** @type {_Positioned} */
            const node = { ...slot.node, x: left, y: top, width, height: heightOf(slot), ports }
            return { node }
        })
        return { end: top + tallest, slots }
    })
    const placed = placedRows.flatMap(row => row.slots)
    return {
        nodes: placed.flatMap(p => p.node === undefined ? [] : [p.node]),
        lanes: placed.flatMap(p => p.lane === undefined ? [] : [p.lane]),
        ends: placedRows.map(row => row.end),
    }
}

/**
 * Every edge's route but an inline one's: from the bottom of its port,
 * straight down to its row's bottom where its node is shorter than the
 * row, straight down through its lane in each rank it skips, and to the
 * top of its target. Nodes and lanes are looked up, not searched for, for
 * the reason {@link layout} gives.
 *
 * **The drop is what lets a node keep its own height.** An edge leaving a
 * short node turned at once would cut across the lower part of a taller
 * neighbour on its way to the next row; dropping first, it turns only in
 * the gap between rows, where there are no boxes.
 *
 * @type {(placed: _Placed) => readonly _Route[]}
 */
const routesOf = placed => {
    const byId = new Map(placed.nodes.map(p => [p.id, p]))
    const at = /** @type {(id: number) => _Positioned} */ (id => /** @type {_Positioned} */ (byId.get(id)))
    const lanes = new Map(placed.lanes.map(lane => [`${lane.index} ${lane.rank}`, lane]))
    return placed.nodes.flatMap(from => from.ports.flatMap(port => {
        const target = port.edge.to
        if (typeof target !== 'number') { return [] }
        const to = at(target)
        const x = from.x + port.x + port.width / 2
        const bottom = from.y + from.height
        /** @type {readonly _Point[]} */
        const points = [
            [x, bottom],
            ...(bottom < placed.ends[from.rank] ? [/** @type {_Point} */ ([x, placed.ends[from.rank]])] : []),
            ...Array.from({ length: to.rank - from.rank - 1 }, (_, i) => {
                const lane = /** @type {_Lane} */ (lanes.get(`${port.index} ${from.rank + 1 + i}`))
                return /** @type {readonly _Point[]} */ ([[lane.x, lane.top], [lane.x, lane.bottom]])
            }).flat(),
            [to.x + to.width / 2, to.y],
        ]
        return [{ edge: port.edge, points }]
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

/** The corner radius of a node's box. */
const radius = /** @type {const} */ (4)

/**
 * The id of the clip that keeps a node's cells inside its rounded box.
 * Square cells drawn over a rounded box poke their corners out past its
 * bottom ones; clipped to the box's own shape, they round with it. The
 * box's border is drawn once more over them, so the cells' thinner lines
 * do not show along its inner half.
 *
 * **The id is the box's geometry, not a counter.** Several graphs can
 * share one page, and ids are page-wide: two clips counted from zero in
 * two drawings would share an id and one would clip the other's cells to
 * the wrong box. Named by geometry, two clips that share an id share a
 * shape too, so whichever one the page finds is right.
 *
 * @type {(p: _Positioned) => string}
 */
const clipIdOf = p => `graph-clip-${p.x}-${p.y}-${p.width}-${p.height}`

/**
 * The height of a port's label cell: one row for an inline port, whose
 * value sits under it, and the whole of the node's ports for an edge's.
 *
 * @type {(p: _Positioned) => (port: _Port) => number}
 */
const labelHeightOf = p => port => inlineOf(port.edge) === null ? p.height - headerHeight : portHeight

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
 * **A primitive is a cell, not a box.** An inline value draws in its port,
 * under the label, and no line leaves for it: see the module's own doc.
 * An inline port is its label's cell over its value's; an edge's port is
 * one cell as tall as the node's ports, its label centred in it. Values
 * carry an attribute of their own, apart from the node labels and the
 * port labels, so the stylesheet can colour a value unlike a key.
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
            x: String(p.x), y: String(p.y), width: String(p.width), height: String(p.height), rx: String(radius),
            'data-graph-node': '', 'data-graph-kind': p.kind,
        }]),
        ...(p.ports.length === 0 ? [] : [/** @type {Element} */ (['g', { 'clip-path': `url(#${clipIdOf(p)})` },
        ...p.ports.map(port => /** @type {Element} */ (['rect', {
            x: String(p.x + port.x), y: String(p.y + headerHeight),
            width: String(port.width), height: String(labelHeightOf(p)(port)),
            'data-graph-port': '',
        }])),
        ...p.ports.flatMap(port => inlineOf(port.edge) === null ? [] : [/** @type {Element} */ (['rect', {
            x: String(p.x + port.x), y: String(p.y + headerHeight + portHeight),
            width: String(port.width), height: String(valueHeight),
            'data-graph-value': '',
            ...valueKindOf(port.edge),
            // An edge carries its kind on its line; a value has no line,
            // so its cell carries the kind instead.
            ...(port.edge.kind === undefined ? {} : { 'data-graph-edge-kind': port.edge.kind }),
        }])]),
        ]),
        // The node's border again, over its cells: their thinner lines
        // would otherwise draw over the inner half of it.
        /** @type {Element} */ (['rect', {
            x: String(p.x), y: String(p.y), width: String(p.width), height: String(p.height), rx: String(radius),
            'data-graph-outline': '',
        }])]),
    ])
    /** @type {readonly Element[]} */
    const clipEls = positioned.flatMap(p => p.ports.length === 0 ? [] : [/** @type {Element} */ (['clipPath', { id: clipIdOf(p) },
        ['rect', { x: String(p.x), y: String(p.y), width: String(p.width), height: String(p.height), rx: String(radius) }]])])
    /** @type {readonly Element[]} */
    const labelEls = positioned.flatMap(p => [
        /** @type {Element} */ (['text', {
            x: String(p.x + p.width / 2), y: String(p.y + headerHeight / 2),
            'text-anchor': 'middle', 'data-graph-label': '',
        }, p.label]),
        ...p.ports.map(port => /** @type {Element} */ (['text', {
            x: String(p.x + port.x + port.width / 2), y: String(p.y + headerHeight + labelHeightOf(p)(port) / 2),
            'text-anchor': 'middle', 'data-graph-edge-label': '',
        }, port.edge.label])),
        ...p.ports.flatMap(port => {
            const inline = inlineOf(port.edge)
            return inline === null ? [] : [/** @type {Element} */ (['text', {
                x: String(p.x + port.x + port.width / 2), y: String(p.y + headerHeight + portHeight + valueHeight / 2),
                'text-anchor': 'middle', 'data-graph-value-label': '',
                ...valueKindOf(port.edge),
            }, inline])]
        }),
    ])
    return ['svg', { viewBox: `0 0 ${width} ${height}`, width: String(width), height: String(height) },
        ['defs',
            ['marker', {
                id: 'graph-arrow', viewBox: '0 0 10 10', refX: '9', refY: '5',
                markerWidth: '6', markerHeight: '6', orient: 'auto',
            },
                ['path', { d: 'M0,0 L10,5 L0,10 z', 'data-graph-arrow': '' }]],
            ...clipEls],
        ...boxEls,
        ...edgeEls,
        ...labelEls,
    ]
}
