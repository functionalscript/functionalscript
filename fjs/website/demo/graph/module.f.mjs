/**
 * A node-and-edge diagram, laid out and drawn as SVG — the shared half of
 * any demo whose value is a graph rather than a scalar. A demo says what
 * {@link Shape} each of its values has; `graphOf` walks a value into
 * {@link Node}s and {@link Edge}s, reference identity deciding what is
 * shared, and this module ranks and draws them.
 *
 * **Ranks run left to right.** The root is the leftmost column, and each
 * rank is a column of its own to the right of the one before, its nodes
 * stacked top to bottom. A node's ports are rows under its label, one per
 * outgoing edge, so a node reads like a record: a key per row, and the
 * edge for that key leaving from the row's right end.
 *
 * **A node's rank is the longest path from the root**, not the first one a
 * walk happens to take: a shared node reached again from a longer route
 * moves right to match, so every edge points right by at least one rank —
 * never straight up or down, never back. Computed by Bellman-Ford
 * relaxation, stopped the moment a round changes nothing, not a
 * topological sort — simpler for a demo-sized graph, and `nodes.length`
 * rounds is the bound the algorithm needs in its worst case rather than
 * what an ordinary graph costs: a flat column of leaves settles in one
 * round regardless of how many there are, since every one of them depends
 * on the root alone.
 *
 * **No edge crosses a box.** Between two neighbouring ranks an edge runs
 * straight across the gap between their columns, where there are no boxes:
 * it leaves the right end of its port and ends at the left of its target's
 * label. An edge that skips ranks — a shared node reached again from left
 * of an intervening one — is given a **lane** in every column it passes: a
 * narrow slot laid out among that column's nodes as if it were one, which
 * the edge runs straight across. Every piece of every edge is then in a
 * gap, in its own lane, or beside its own node, so none can pass over a
 * node or its text. It is the layered layout's usual answer, the
 * placeholder nodes Graphviz's `dot` inserts, and why an edge here is a run
 * of straight segments rather than a curve.
 *
 * **A primitive draws inside the node that holds it.** An edge whose `to`
 * is an {@link Inline} value leaves no line: its row grows a second cell,
 * right of the edge's label, holding the value. A number or a `null` has no
 * identity to share, so a box of its own, a line and an arrow would only
 * spend a rank and a lane saying what one cell says.
 *
 * @module
 *
 * @import { Edge, Graph, Inline, Node, Ranked, Shape } from './types.ts'
 * @import { Element } from '../../../media/html/types.ts'
 * @import { _Column, _Lane, _Out, _Placed, _PlacedSlot, _Point, _Port, _Positioned, _Route, _Size, _Sized, _Slot, _Walk } from './private.ts'
 * @import { StateScan } from '../../../types/function/operator/types.ts'
 */

import { stateScan, toArray } from '../../../types/list/module.f.mjs'

/**
 * Every node's rank: the longest path from the root, so every edge points
 * right by at least one rank and never straight up or down, or back. A
 * node's id is its index here — a demo's own walk is expected to assign
 * ids `0, 1, 2, …` in creation order with no gaps, root first — so
 * `current[edge.from]` reads a node by id directly.
 *
 * Incoming edges are grouped by target once, not searched for per node on
 * every round: `edges.filter` inside the loop turned this quadratic in the
 * number of rounds a large shared graph took to settle, measured directly on
 * the DataJS demo — a 1500-element document went from 138 ms to 3.9 s under
 * that version.
 *
 * A round builds the next ranks from the prior ones and compares the two
 * after, rather than flagging a change from inside `map`'s callback; the
 * same 1500-element document takes as long as it did with the flag.
 *
 * @type {(nodes: readonly Node[], edges: readonly Edge[]) => readonly Ranked[]}
 */
export const ranked = (nodes, edges) => {
    /** @type {readonly (readonly Edge[])[]} */
    const incomingOf = nodes.map(n => edges.filter(e => e.to === n.id))
    let current = nodes.map(n => ({ ...n, rank: n.id === 0 ? 0 : -Infinity }))
    for (let round = 0; round < nodes.length; round++) {
        const prior = current
        current = prior.map((node, i) => {
            const best = incomingOf[i].reduce((m, e) => Math.max(m, prior[e.from].rank + 1), node.rank)
            return best === node.rank ? node : { ...node, rank: best }
        })
        if (current.every((node, i) => node === prior[i])) { break }
    }
    return current
}

const { is } = Object

/**
 * `root` as the graph it denotes, each value read by `shape`.
 *
 * **A value whose shape is a node is drawn once**, and found again by
 * identity (`Object.is`) on any later edge to it: two edges to one value
 * are one node with two incoming edges, not two nodes that happen to look
 * alike. A value whose shape is inline is drawn in its parent's port. A
 * root whose shape is inline, having no port to sit in, is one node whose
 * `kind` is the inline's own where it has one and `"leaf"` where it has
 * none.
 *
 * **A value that reaches itself is refused.** An edge back to a node the
 * walk is still inside would be drawn pointing left, which is the one thing
 * {@link ranked}'s longest path cannot place: it would push the cycle's
 * ranks up for as many rounds as it runs and answer a plausible wrong
 * picture instead.
 *
 * Ranks nothing while it walks: which rank a node belongs to depends on
 * every edge that reaches it, including ones the walk has not taken yet
 * when it first creates the node, so {@link ranked} decides that
 * afterward, once the whole graph is known.
 */
export const graphOf =
    /**
     * @template V
     * @param {(v: V) => Shape<V>} shape
     * @returns {(root: V) => Graph}
     */
    shape => root => {
        /**
         * `value`'s node id, and the walk with `value` and everything under
         * it added — or just the walk, when `value` is already drawn.
         * `path` is the ids of the nodes the walk is inside, root first.
         *
         * @type {(walk: _Walk, path: readonly number[]) => (value: V, s: Shape<V>) => { readonly id: number, readonly walk: _Walk }}
         */
        const node = (walk, path) => (value, s) => {
            const found = walk.refs.find(([r]) => is(r, value))
            if (found !== undefined) {
                if (path.includes(found[1])) { throw `graph: a cycle through node ${found[1]}` }
                return { id: found[1], walk }
            }
            const id = walk.next
            const [kind, label, children] = 'inline' in s
                ? [s.kind ?? 'leaf', s.inline, []]
                : [s.kind, s.label, s.children]
            /** @type {_Walk} */
            const withNode = {
                refs: [...walk.refs, [value, id]],
                nodes: [...walk.nodes, { id, kind, label }],
                edges: walk.edges,
                next: id + 1,
            }
            const inside = [...path, id]
            const final = children.reduce(
                /** @type {(acc: _Walk, child: readonly [string, V, string?]) => _Walk} */
                (acc, [label, child, kind]) => {
                    const c = shape(child)
                    if ('inline' in c) {
                        return { ...acc, edges: [...acc.edges, { from: id, to: c, label, kind }] }
                    }
                    const step = node(acc, inside)(child, c)
                    return { ...step.walk, edges: [...step.walk.edges, { from: id, to: step.id, label, kind }] }
                },
                withNode)
            return { id, walk: final }
        }
        const { walk } = node({ refs: [], nodes: [], edges: [], next: 0 }, [])(root, shape(root))
        return { nodes: ranked(walk.nodes, walk.edges), edges: walk.edges }
    }

const headerHeight = /** @type {const} */ (26)
const portHeight = /** @type {const} */ (20)
const rankGap = /** @type {const} */ (40)
const nodeGap = /** @type {const} */ (14)
const laneSize = /** @type {const} */ (10)
const margin = /** @type {const} */ (10)
const charWidth = /** @type {const} */ (7)
const entryLength = /** @type {const} */ (24)
const entrySpread = /** @type {const} */ (8)

/** @type {(label: string) => number} */
const widthOf = label => Math.max(50, label.length * charWidth + 16)

/** @type {(label: string) => number} */
const cellWidthOf = label => Math.max(24, label.length * charWidth + 12)

/** @type {(edge: Edge) => string | null} */
const inlineOf = ({ to }) => typeof to === 'number' ? null : to.inline

/** @type {(values: readonly number[]) => number} */
const max = values => values.reduce((m, v) => Math.max(m, v), 0)

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
 * The attribute of the two groups a node is drawn in — its box with its
 * rows, and its text, which are apart because edges are drawn between
 * them: the node's kind, so a stylesheet can treat the whole node as one,
 * where `data-graph-kind`, on the box alone, styles the box. They are two
 * names because a rule meant for a box, a fill or a dash, would be wrong
 * on text.
 *
 * @type {(p: _Positioned) => { readonly 'data-graph-in-kind': string }}
 */
const inKindOf = p => ({ 'data-graph-in-kind': p.kind })

/**
 * A node's ports: one row per outgoing edge, in the order the demo gave
 * the edges, stacked under the node's label.
 *
 * **The rows are a table.** Every inline port is its key's cell and its
 * value's, side by side, and the keys line up in one column: `keyWidth` is
 * the widest inline key, and the values take the rest of the node. An
 * edge's port has no value, so its key fills the whole row, as wide as the
 * node — no row carries an empty cell. A node is as wide as the widest of
 * its label, a key beside its value, and an edge's key.
 *
 * **An inline port with an empty key is its value alone**, filling the
 * row, for a demo whose values need no name: a key column holding nothing
 * would only push the value aside. Such a port takes no part in the key
 * column.
 *
 * **An empty label is no row at all** when the node has ports: its rows
 * already say what it is, and an empty header would be a blank band on
 * top of them. An edge into such a node arrives at its first row instead.
 * A node with neither keeps its header, or it would have no height.
 *
 * @type {(label: string) => (out: readonly _Out[]) => _Size}
 */
const portsOf = label => out => {
    const header = label === '' && out.length > 0 ? 0 : headerHeight
    const inlines = out.flatMap(({ edge }) => {
        const inline = inlineOf(edge)
        return inline === null ? [] : [{ keyed: edge.label !== '', key: cellWidthOf(edge.label), value: cellWidthOf(inline) }]
    })
    const keyColumn = max(inlines.flatMap(c => c.keyed ? [c.key] : []))
    const width = Math.max(
        widthOf(label),
        max(inlines.map(c => (c.keyed ? keyColumn : 0) + c.value)),
        max(out.flatMap(({ edge }) => inlineOf(edge) === null ? [cellWidthOf(edge.label)] : [])))
    return {
        width,
        height: header + out.length * portHeight,
        keyWidth: keyColumn,
        entry: (header === 0 ? portHeight : header) / 2,
        ports: out.map(({ edge, index }, i) => ({ edge, index, y: header + i * portHeight })),
    }
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
 * Every column, left to right: its nodes and lanes in `key` order, each
 * placed top to bottom, and the column as wide as its widest node. A lane
 * spans its column's whole width, so the next column starts right of it
 * and right of any node alike.
 *
 * A node is its label and a row per port under it, as {@link portsOf} lays
 * them out; a node without ports is the label alone, so a leaf keeps the
 * size it always had. **A node is as wide as its own content**, not as its
 * column: its edges run straight right to the column's edge before they
 * turn — see {@link routesOf}.
 *
 * **An edge has a lane in every rank strictly between its ends**, and none
 * when it goes to the next rank, or to an inline value, which has no
 * rank. A lane's `key` places it just after its source's id, among the
 * nodes ordered by id, so it sits near where its edge starts rather than
 * at the far end of a column. It carries its edge's `index`, its position
 * in the graph's list, because that is what tells two edges apart: the
 * same `Edge` object may be listed twice, and a lane found by object would
 * belong to both.
 *
 * **Nothing here scans more than it has to.** Lanes are the one part of
 * the drawing that grows faster than the graph — a root reaching every
 * node of an `n`-long chain needs about `n²/2` of them — so a column's
 * lanes are read off each edge's span of ranks rather than filtered out
 * of every lane there is, and a column is placed with a running `y`,
 * carried by `stateScan`, rather than by copying what it has placed so far
 * at every step. Built
 * the obvious way, both were quadratic in the lanes; a 300-node chain of
 * that shape took five times as long as the drawing had before lanes
 * existed.
 *
 * The first column starts at `left`.
 *
 * @type {(left: number) => (nodes: readonly Ranked[]) => (edges: readonly Edge[]) => _Placed}
 */
const layout = left => nodes => edges => {
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
    const columns = Array.from({ length: maxRank + 1 }, (_, rank) => [
        ...nodes.filter(node => node.rank === rank).map(node => ({ node, rank, key: node.id })),
        ...spans.flatMap((span, lane) => span.from < rank && rank < span.to ? [{ lane, rank, key: span.key }] : []),
    ].toSorted((a, b) => a.key - b.key))
    /** @type {(left: number) => (widest: number) => StateScan<_Sized, number, _PlacedSlot>} */
    const placeSlot = left => widest => ({ slot, size }, top) => {
        if (size === null) {
            /** @type {_Lane} */
            const lane = { index: /** @type {number} */ (slot.lane), rank: slot.rank, y: top + laneSize / 2, left, right: left + widest }
            return [{ lane }, top + laneSize + nodeGap]
        }
        /** @type {_Positioned} */
        const node = { .../** @type {Ranked} */ (slot.node), x: left, y: top, ...size }
        return [{ node }, top + size.height + nodeGap]
    }
    /** @type {StateScan<readonly _Slot[], number, _Column>} */
    const placeColumn = (column, left) => {
        const sized = column.map(slot => ({ slot, size: slot.node === undefined ? null : portsOf(slot.node.label)(outgoingOf(slot.node.id)) }))
        const widest = sized.reduce((m, { size }) => Math.max(m, size === null ? laneSize : size.width), 0)
        const slots = toArray(stateScan(placeSlot(left)(widest))(margin)(sized))
        return [{ end: left + widest, slots }, left + widest + rankGap]
    }
    const placedColumns = toArray(stateScan(placeColumn)(left)(columns))
    const placed = placedColumns.flatMap(column => column.slots)
    return {
        nodes: placed.flatMap(p => p.node === undefined ? [] : [p.node]),
        lanes: placed.flatMap(p => p.lane === undefined ? [] : [p.lane]),
        ends: placedColumns.map(column => column.end),
    }
}

/**
 * Every edge's route but an inline one's: from the right end of its port,
 * straight right to its column's edge where its node is narrower than the
 * column, straight across its lane in each rank it skips, and to the left
 * of its target's label. Nodes and lanes are looked up, not searched for,
 * for the reason {@link layout} gives.
 *
 * **The run to the column's edge is what lets a node keep its own
 * width.** An edge leaving a narrow node turned at once would cut across
 * a wider neighbour above or below it on its way to the next column;
 * running right first, it turns only in the gap between columns, where
 * there are no boxes.
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
        const y = from.y + port.y + portHeight / 2
        const right = from.x + from.width
        /** @type {readonly _Point[]} */
        const points = [
            [right, y],
            ...(right < placed.ends[from.rank] ? [/** @type {_Point} */ ([placed.ends[from.rank], y])] : []),
            ...Array.from({ length: to.rank - from.rank - 1 }, (_, i) => {
                const lane = /** @type {_Lane} */ (lanes.get(`${port.index} ${from.rank + 1 + i}`))
                return /** @type {readonly _Point[]} */ ([[lane.left, lane.y], [lane.right, lane.y]])
            }).flat(),
            [to.x, to.y + to.entry],
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
 * `g` laid out, with room left of the first column for its entries' arrows
 * when it has any. **An entry must name a node of the graph**, for the
 * reason an edge must ({@link layout}): an arrow into nothing would simply
 * vanish.
 *
 * @type {(g: Graph) => _Placed}
 */
const placedOf = ({ nodes, edges, entries = [] }) => {
    const ids = new Set(nodes.map(n => n.id))
    const missing = entries.findIndex(({ to }) => !ids.has(to))
    if (missing !== -1) { throw `graph: entry ${missing} ends at node ${entries[missing].to}, which is not in the graph` }
    return layout(margin + (entries.length === 0 ? 0 : entryLength))(nodes)(edges)
}

/**
 * The number of edge segments that pass through a node's box — zero for
 * every graph this module draws, which is the claim {@link graphSvg} makes
 * and the proofs hold it to on each demo's own graphs.
 *
 * @type {(g: Graph) => number}
 */
export const _crossings = g => {
    const placed = placedOf(g)
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
 * A graph, drawn: a node per {@link Ranked}, an edge per {@link Edge},
 * ranked by longest path from the root, left to right.
 *
 * **Every edge leaves from a port of its own.** A node with outgoing
 * edges draws a row under its label per edge, each holding that edge's
 * label, and the edge starts at the right end of its row. From a row
 * each, no two edges share a start, a label always sits in the box it
 * names, and two edges to one node — `[a, a]`, or `a && a` — need nothing
 * merged.
 *
 * **A primitive is a cell, not a box.** An inline value draws in its row,
 * right of the key, and no line leaves for it: see the module's own doc.
 * Values carry an attribute of their own, apart from the node labels and
 * the port labels, so the stylesheet can colour a value unlike a key.
 *
 * **Boxes, then edges, then the labels.** Since no edge crosses a box the
 * order decides only where an edge meets its own ends, and there the line
 * draws over the border it starts or stops on. Edges carry no casing: a
 * background stroke under each line was there to part a line from a box it
 * crossed, and with nothing crossed it would only notch the borders the
 * edges meet and cut gaps into every line another one crosses.
 *
 * **The drawing comes in a container of its own**, a `div` marked
 * `data-graph`, which the site's stylesheet scrolls sideways. A graph is
 * as wide as its ranks or its ports make it, often wider than the page,
 * and without the container the whole page would scroll with it.
 *
 * @type {(g: Graph) => Element}
 */
export const graphSvg = g => {
    const placed = placedOf(g)
    const positioned = placed.nodes
    const width = margin + max([
        ...positioned.map(p => p.x + p.width),
        ...placed.lanes.map(lane => lane.right),
    ])
    const height = margin + max([
        ...positioned.map(p => p.y + p.height),
        ...placed.lanes.map(lane => lane.y + laneSize / 2),
    ])
    /** @type {readonly Element[]} */
    const edgeEls = routesOf(placed).map(({ edge, points }) => ['path', {
        d: `M${points.map(([x, y]) => `${x},${y}`).join(' L')}`,
        'data-graph-edge': '', 'marker-end': 'url(#graph-arrow)',
        ...(edge.kind === undefined ? {} : { 'data-graph-edge-kind': edge.kind }),
    }])
    const entries = g.entries ?? []
    // An entry runs straight right into its node, level with where an edge
    // would arrive. Several into one node start a little apart and meet
    // there, so none is drawn over another.
    /** @type {readonly Element[]} */
    const entryEls = positioned.flatMap(p => {
        const into = entries.filter(({ to }) => to === p.id)
        const y = p.y + p.entry
        return into.map(({ kind }, i) => /** @type {Element} */ (['path', {
            d: `M${p.x - entryLength},${y + (i - (into.length - 1) / 2) * entrySpread} L${p.x},${y}`,
            'data-graph-edge': '', 'data-graph-entry': '', 'marker-end': 'url(#graph-arrow)',
            ...(kind === undefined ? {} : { 'data-graph-edge-kind': kind }),
        }]))
    })
    /**
     * How wide a port's key cell is: the whole row for an edge, nothing for
     * a value with an empty key, and the key column for any other value.
     *
     * @type {(p: _Positioned) => (port: _Port) => number}
     */
    const keyWidthOf = p => port => inlineOf(port.edge) === null ? p.width
        : port.edge.label === '' ? 0
        : p.keyWidth
    /** @type {readonly Element[]} */
    const boxEls = positioned.map(p => ['g', inKindOf(p),
        /** @type {Element} */ (['rect', {
            x: String(p.x), y: String(p.y), width: String(p.width), height: String(p.height), rx: String(radius),
            'data-graph-node': '', 'data-graph-kind': p.kind,
        }]),
        ...(p.ports.length === 0 ? [] : [/** @type {Element} */ (['g', { 'clip-path': `url(#${clipIdOf(p)})` },
            ...p.ports.flatMap(port => keyWidthOf(p)(port) === 0 ? [] : [/** @type {Element} */ (['rect', {
                x: String(p.x), y: String(p.y + port.y),
                width: String(keyWidthOf(p)(port)), height: String(portHeight),
                'data-graph-port': '',
            }])]),
            ...p.ports.flatMap(port => inlineOf(port.edge) === null ? [] : [/** @type {Element} */ (['rect', {
                x: String(p.x + keyWidthOf(p)(port)), y: String(p.y + port.y),
                width: String(p.width - keyWidthOf(p)(port)), height: String(portHeight),
                'data-graph-value': '',
                // A value with no key is the whole row, so it is left
                // unfilled: a tint across every row would hide the node's
                // own fill, which is what its kind is drawn with.
                ...(keyWidthOf(p)(port) === 0 ? { 'data-graph-value-alone': '' } : {}),
                ...valueKindOf(port.edge),
                // An edge carries its kind on its line; a value has no
                // line, so its cell carries the kind instead.
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
    const labelEls = positioned.map(p => ['g', inKindOf(p),
        ...(p.label === '' ? [] : [/** @type {Element} */ (['text', {
            x: String(p.x + p.width / 2), y: String(p.y + headerHeight / 2),
            'text-anchor': 'middle', 'data-graph-label': '',
        }, p.label])]),
        ...p.ports.flatMap(port => keyWidthOf(p)(port) === 0 ? [] : [/** @type {Element} */ (['text', {
            x: String(p.x + keyWidthOf(p)(port) / 2), y: String(p.y + port.y + portHeight / 2),
            'text-anchor': 'middle', 'data-graph-edge-label': '',
        }, port.edge.label])]),
        ...p.ports.flatMap(port => {
            const inline = inlineOf(port.edge)
            return inline === null ? [] : [/** @type {Element} */ (['text', {
                x: String(p.x + (keyWidthOf(p)(port) + p.width) / 2), y: String(p.y + port.y + portHeight / 2),
                'text-anchor': 'middle', 'data-graph-value-label': '',
                ...valueKindOf(port.edge),
            }, inline])]
        }),
    ])
    return ['div', { 'data-graph': '' }, ['svg', { viewBox: `0 0 ${width} ${height}`, width: String(width), height: String(height) },
        ['defs',
            ['marker', {
                id: 'graph-arrow', viewBox: '0 0 10 10', refX: '9', refY: '5',
                markerWidth: '6', markerHeight: '6', orient: 'auto',
            },
                ['path', { d: 'M0,0 L10,5 L0,10 z', 'data-graph-arrow': '' }]],
            ...clipEls],
        ...boxEls,
        ...edgeEls,
        ...entryEls,
        ...labelEls,
    ]]
}
