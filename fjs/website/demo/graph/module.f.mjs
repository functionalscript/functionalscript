/**
 * A node-and-edge diagram, laid out and drawn as SVG — the shared half of
 * any demo whose value is a graph rather than a scalar. A demo says what
 * {@link Shape} each of its values has; `graphOf` walks a value into
 * {@link Node}s and {@link Edge}s, reference identity deciding what is
 * shared, and this module ranks and draws them.
 *
 * **Ranks run left to right.** The root is the leftmost column, and each
 * rank is a column of its own to the right of the one before, its nodes
 * stacked top to bottom. A node's ports are rows right of its label, one
 * per outgoing edge, so a node reads like a record: its name on the left,
 * a key per row, and the edge for that key leaving from the row's right
 * end. **A tree draws each
 * parent beside its children** instead, centred on them, so its arrows
 * stay short: see {@link treeTopsOf}.
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
 * it leaves the right end of its port and ends at the middle of its
 * target's left side, its label. An edge that skips ranks — a shared node reached again from left
 * of an intervening one — is given a **lane** in every column it passes: a
 * narrow slot laid out among that column's nodes as if it were one, which
 * the edge runs straight across. Every piece of every edge is then in a
 * gap, in its own lane, or beside its own node, so none can pass over a
 * node or its text. It is the layered layout's usual answer, the
 * placeholder nodes Graphviz's `dot` inserts, and why an edge here is a run
 * of straight segments rather than a curve.
 *
 * **A back edge goes around the graph.** An edge marked `back`, which
 * closes a cycle, is left out of ranking and drawn down a gap, along a
 * lane below every node and up another gap, so it crosses no box either.
 *
 * **A primitive draws inside the node that holds it.** An edge whose `to`
 * is an {@link Inline} value leaves no line: its row grows a second cell,
 * right of the edge's label, holding the value. A number or a `null` has no
 * identity to share, so a box of its own, a line and an arrow would only
 * spend a rank and a lane saying what one cell says.
 *
 * @module
 *
 * @import { Back, Corner, Edge, Graph, Inline, Node, Ranked, Shape } from './types.ts'
 * @import { Element } from '../../../media/html/types.ts'
 * @import { _BackEdge, _BackLane, _Column, _Lane, _Out, _Placed, _PlacedSlot, _Point, _Port, _Positioned, _Route, _Size, _Sized, _Slot, _Stack, _Frame, _Walk } from './private.ts'
 * @import { StateScan } from '../../../types/function/operator/types.ts'
 */

import { stateScan, toArray } from '../../../types/list/module.f.mjs'
import { min } from '../../../types/number/min/module.f.js'
import { max } from '../../../types/number/max/module.f.js'
import { assertNotNullish } from '../../../asserts/module.f.js'

/**
 * Every node's rank: the longest path from the root, so every edge points
 * right by at least one rank and never straight up or down, or back. A
 * `back` edge is not a path, so it ranks nothing. A
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
    const incomingOf = nodes.map(n => edges.filter(e => e.to === n.id && e.back !== true))
    let current = nodes.map(n => ({ ...n, rank: n.id === 0 ? 0 : -Infinity }))
    for (let round = 0; round < nodes.length; round++) {
        const prior = current
        current = prior.map((node, i) => {
            const best = incomingOf[i].reduce((m, e) => max(m, prior[e.from].rank + 1), node.rank)
            return best === node.rank ? node : { ...node, rank: best }
        })
        if (current.every((node, i) => node === prior[i])) { break }
    }
    return current
}

const { is } = Object

/**
 * `walk` with `value` drawn as a new node: its id, and its children to
 * walk next.
 *
 * @template V
 * @param {_Walk} walk
 * @param {V} value
 * @param {Exclude<Shape<V>, Back<V>>} s
 * @returns {{ readonly id: number, readonly walk: _Walk, readonly children: _Frame<V>['children'] }}
 */
const draw = (walk, value, s) => {
    const id = walk.next
    const [kind, label, children, groups] = 'inline' in s
        ? [s.kind ?? 'leaf', s.inline, [], undefined]
        : [s.kind, s.label, s.children, s.groups]
    return {
        id,
        walk: {
            refs: [...walk.refs, [value, id]],
            nodes: [...walk.nodes, { id, kind, label, ...(groups === undefined ? {} : { groups }) }],
            edges: walk.edges,
            next: id + 1,
        },
        children,
    }
}

/** `walk` with `edge` added. @type {(walk: _Walk, edge: Edge) => _Walk} */
const withEdge = (walk, edge) => ({ ...walk, edges: [...walk.edges, edge] })

const noOwner = 'graph: a back reference outside every node it could go back to'

/**
 * The id of the innermost node on `stack` that `owner` takes, each read
 * with the label of the child the walk is in. Every frame on `stack` has
 * moved past that child, so it is the one before `next`.
 *
 * **A back reference with no owner is refused**: an edge to no node would
 * vanish and leave a picture that looks complete.
 *
 * @template V
 * @param {_Stack<V>} stack
 * @param {Back<V>['owner']} owner
 * @returns {number}
 */
const ownerOf = (stack, owner) => {
    let s = stack
    while (s !== undefined) {
        const [frame, rest] = s
        if (owner(frame.value, frame.children[frame.next - 1][0])) { return frame.id }
        s = rest
    }
    throw noOwner
}

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
 * **A value that reaches itself is refused unless its node shape opts in
 * with `recursive: true`.** An edge back to a node the
 * walk is still inside would be drawn pointing left, which is the one thing
 * {@link ranked}'s longest path cannot place: it would push the cycle's
 * ranks up for as many rounds as it runs and answer a plausible wrong
 * picture instead. With the opt-in, that use is a back edge and does not
 * participate in ranking. The value's identity still shares its definition,
 * so recursive thunks can describe a finite graph without expanding forever.
 *
 * **A reference to an enclosing node can also be a {@link Back} shape**:
 * an edge, marked `back`, to the innermost node the walk is inside that the shape's
 * `owner` takes. Ranking ignores it, so it has no rank to need. A root
 * that is a back reference is inside no node, and is refused.
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
        // Depth first, on a stack of its own rather than the call stack: a
        // graph is as deep as its longest path, and a recursive walk ran
        // out of stack on a path of a couple of thousand nodes. A node's
        // edge from its parent is added once everything under it is
        // drawn, so ids and edges come out in the order recursion gave.
        const rootShape = shape(root)
        if ('owner' in rootShape) { throw noOwner }
        const start = draw({ refs: [], nodes: [], edges: [], next: 0 }, root, rootShape)
        let walk = start.walk
        /** @type {_Stack<V>} */
        let stack = [{ value: root, id: start.id, path: [start.id], children: start.children, next: 0, label: '', kind: undefined }, undefined]
        while (stack !== undefined) {
            /** @type {readonly [_Frame<V>, _Stack<V>]} */
            const [top, rest] = stack
            if (top.next === top.children.length) {
                // everything under `top` is drawn: the edge that reached it closes it
                walk = rest === undefined ? walk : withEdge(walk, { from: rest[0].id, to: top.id, label: top.label, kind: top.kind })
                stack = rest
            } else {
                const [label, child, kind] = top.children[top.next]
                /** @type {_Stack<V>} */
                const advanced = [{ ...top, next: top.next + 1 }, rest]
                const c = shape(child)
                if ('owner' in c) {
                    walk = withEdge(walk, { from: top.id, to: ownerOf(advanced, c.owner), label, kind, back: true })
                    stack = advanced
                } else if ('inline' in c) {
                    walk = withEdge(walk, { from: top.id, to: c, label, kind })
                    stack = advanced
                } else {
                    const found = walk.refs.find(([r]) => is(r, child))
                    if (found === undefined) {
                        const drawn = draw(walk, child, c)
                        walk = drawn.walk
                        stack = [{ value: child, id: drawn.id, path: [...top.path, drawn.id], children: drawn.children, next: 0, label, kind }, advanced]
                    } else {
                        // a value already drawn is one node however many
                        // edges reach it, unless the walk is still inside it
                        const back = top.path.includes(found[1])
                        if (back && c.recursive !== true) { throw `graph: a cycle through node ${found[1]}` }
                        walk = withEdge(walk, { from: top.id, to: found[1], label, kind, ...(back ? { back: true } : {}) })
                        stack = advanced
                    }
                }
            }
        }
        return { nodes: ranked(walk.nodes, walk.edges), edges: walk.edges }
    }

const labelHeight = /** @type {const} */ (26)
const portHeight = /** @type {const} */ (20)
const rankGap = /** @type {const} */ (40)
const nodeGap = /** @type {const} */ (14)
const laneSize = /** @type {const} */ (10)
const margin = /** @type {const} */ (10)
const charWidth = /** @type {const} */ (7)
const entryLength = /** @type {const} */ (24)

/** @type {(label: string) => number} */
const widthOf = label => max(50, label.length * charWidth + 16)

/** @type {(label: string) => number} */
const cellWidthOf = label => max(24, label.length * charWidth + 12)

/** @type {(edge: Edge) => string | null} */
const inlineOf = ({ to }) => typeof to === 'number' ? null : to.inline

/**
 * What a port draws in its value cell: its inline value, or the label of
 * the node its edge leads to where the row shows that instead, or nothing.
 *
 * @type {(port: _Port) => string | null}
 */
const valueOf = port => inlineOf(port.edge) ?? port.ref

/**
 * A port's key cell fills the row when there is no value/reference cell;
 * otherwise it uses the shared key-column width, or zero for an empty key.
 *
 * @type {(p: _Positioned) => (port: _Port) => number}
 */
const keyWidthOf = p => port => valueOf(port) === null ? p.width - p.title
    : port.edge.label === '' ? 0
    : p.keyWidth

/**
 * The attribute a row showing its target's label draws with, on its cell
 * and its text alike, or none.
 *
 * @type {(port: _Port) => { readonly 'data-graph-value-ref'?: '' }}
 */
const refAttrOf = port => port.ref === null ? {} : { 'data-graph-value-ref': '' }

/** @type {(values: readonly number[]) => number} */
const maxOf = values => values.reduce((m, v) => max(m, v), 0)

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
 * The attributes an inline value's `click` draws with, on its cell: a
 * control the demo runtime hears, which the keyboard can reach. The cell
 * takes the pointer even where the stylesheet leaves it unfilled, and the
 * text over it lets the pointer through, so the whole cell is the target.
 *
 * @type {(edge: Edge) => { readonly [k in string]?: string }}
 */
const clickOf = ({ to }) => typeof to === 'number' || to.click === undefined ? {} : {
    'data-demo-click': to.click.name, tabindex: '0', role: 'button', 'aria-label': to.click.label,
    'pointer-events': 'all', cursor: 'pointer',
}

/**
 * The attribute of the two groups a node is drawn in — its box with its
 * rows, and its text, which are apart because edges are drawn between
 * them: the node's kind, so a stylesheet can treat the whole node as one,
 * where `data-graph-kind`, on the box alone, styles the box. They are two
 * names because a rule meant for a box, a fill or a dash, would be wrong
 * on text. A node with an `order` carries it on both groups too, so its
 * box and its text fade as one.
 *
 * @type {(p: _Positioned) => { readonly 'data-graph-in-kind': string, readonly 'data-graph-order'?: string }}
 */
const inKindOf = p => ({
    'data-graph-in-kind': p.kind,
    ...(p.order === undefined ? {} : { 'data-graph-order': String(p.order) }),
})

/**
 * What an edge fades with: the node it leads to, if that one has an order,
 * or else the node it leaves from — nothing when neither has one. So an
 * edge into a node appears and goes with it, and an edge out of a node to
 * one that stays goes with the node it leaves. Its kind and order are the
 * ones the stylesheet reads off a node's groups.
 *
 * @type {(nodeOf: (id: number) => _Positioned) => (from: number, to: number) => { readonly 'data-graph-in-kind'?: string, readonly 'data-graph-order'?: string }}
 */
const fadeOf = nodeOf => (from, to) => {
    const target = nodeOf(to)
    const owner = target.order !== undefined ? target : nodeOf(from)
    return owner.order !== undefined ? inKindOf(owner) : {}
}

/**
 * An edge's or an entry's `data-key` in a keyed graph, from the keys of the
 * nodes it joins, so a page that patches the drawing keeps the same path
 * for it, and the site's stylesheet slides its route with its nodes. None
 * when a node it joins has no key. The keys are written as a JSON array, so
 * no key's own characters can make two edges' keys the same.
 *
 * @type {(part: string, ...keys: readonly (string | undefined)[]) => { readonly 'data-key'?: string }}
 */
const pathKeyOf = (part, ...keys) =>
    keys.every(k => k !== undefined) ? { 'data-key': `${part}:${JSON.stringify(keys)}` } : {}

/**
 * Where a node's contents are drawn, and the attributes of the groups that
 * hold them. A node with a `key` is drawn at the origin, its groups moved
 * into place by a `transform` and keyed for the box and the text apart; any
 * other is drawn where it is, as it always was.
 *
 * @type {(p: _Positioned) => { readonly local: _Positioned, readonly group: (part: string) => { readonly transform?: string, readonly 'data-key'?: string } }}
 */
const placeOf = p => p.key === undefined
    ? { local: p, group: () => ({}) }
    : { local: { ...p, x: 0, y: 0 }, group: part => ({ transform: `translate(${p.x},${p.y})`, 'data-key': `${part}:${p.key}` }) }

/**
 * A node's ports: one row per outgoing edge, in the order the demo gave
 * the edges, stacked right of the node's label.
 *
 * **The label is a column of its own**, `title` wide and as tall as the
 * rows, its text centred on them: the label names the whole record, so it
 * stands beside every row rather than over the first one, and a node is
 * no taller than its rows. A node without ports is its label alone, and
 * `title` is then its whole width.
 *
 * **The rows are a table.** Every inline port is its key's cell and its
 * value's, side by side, and the keys line up in one column: `keyWidth` is
 * the widest inline key, and the values take the rest of the node. An
 * edge's port has no value, so its key fills the whole row — no row
 * carries an empty cell. A node is as wide as its label column plus the
 * widest of a key beside its value and an edge's key, and never narrower
 * than a node of its label alone; the rows take any width left over.
 *
 * **An inline port with an empty key is its value alone**, filling the
 * row, for a demo whose values need no name: a key column holding nothing
 * would only push the value aside. Such a port takes no part in the key
 * column.
 *
 * **An edge with a corner takes no row**: it leaves from that point of the
 * node's right side, and the rows are the other edges'.
 *
 * **An edge beside values draws its target's label**, in the value's
 * place, and its key, if any, in the key column: a row that differs from
 * its neighbours by a missing value would read as one, and its key would
 * not line up with theirs. The label says what the edge leads to, as an
 * inline reference by name would. So does an edge with an empty key
 * beside other edges, which would otherwise be a blank row. Its own
 * attribute lets the stylesheet draw it as part of the edge, not as a
 * value. A target with no label leaves the row as it was.
 *
 * **Rows that are all empty edge ports draw nothing**: a row holding no key
 * and no value says nothing, so such a node is its label alone, as wide as
 * a node without ports. It keeps a row's height per edge, so each edge
 * still leaves from a point of its own on the node's right side.
 *
 * **An empty label is no column at all** when the node has ports: its rows
 * already say what it is, and an empty column would be a blank band
 * beside them. A node with neither keeps its label, or it would have no
 * size.
 *
 * **A node with groups draws a cell per group in its label column**, as
 * wide as the widest group's label, in place of the node's own label: see
 * {@link Node}. A grouped node's rows are always drawn.
 *
 * **An edge into a node arrives at the middle of its left side**, which is
 * the middle of its label: between a two-key node's keys, not at the first
 * one.
 *
 * @type {(node: Node) => (out: readonly _Out[]) => _Size}
 */
const portsOf = ({ label, groups }) => all => {
    const out = all.filter(({ edge }) => edge.corner === undefined)
    const blank = groups === undefined && out.every(({ edge }) => inlineOf(edge) === null && edge.label === '')
    /** @type {(o: _Out) => string | null} */
    const refOf = ({ edge, target }) => blank || inlineOf(edge) !== null || target === '' ? null
        : edge.label === '' || out.some(o => inlineOf(o.edge) !== null) ? target
        : null
    /** @type {(o: _Out) => string | null} */
    const valueOf = o => inlineOf(o.edge) ?? refOf(o)
    const inlines = out.flatMap(o => {
        const value = valueOf(o)
        return value === null ? [] : [{ keyed: o.edge.label !== '', key: cellWidthOf(o.edge.label), value: cellWidthOf(value) }]
    })
    const keyColumn = maxOf(inlines.flatMap(c => c.keyed ? [c.key] : []))
    const rows = max(
        maxOf(inlines.map(c => (c.keyed ? keyColumn : 0) + c.value)),
        maxOf(out.flatMap(o => valueOf(o) === null ? [cellWidthOf(o.edge.label)] : [])))
    const title = blank ? widthOf(label)
        : groups !== undefined ? maxOf(groups.map(([group]) => cellWidthOf(group)))
        : label === '' ? 0 : cellWidthOf(label)
    const width = blank ? title : max(groups === undefined ? widthOf(label) : 0, title + rows)
    const height = out.length === 0 ? labelHeight : out.length * portHeight
    /** @type {Record<Corner, number>} */
    const exitAt = { top: 0, middle: height / 2, bottom: height }
    return {
        width,
        height,
        title,
        keyWidth: keyColumn,
        ports: out.map((o, i) => ({ ...o, y: i * portHeight, ref: refOf(o) })),
        exits: all.flatMap(o => o.edge.corner === undefined ? [] : [{ ...o, y: exitAt[o.edge.corner] }]),
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
 * Each node's top, when the graph is a tree, or `null` when it is not.
 *
 * **A tree draws each parent beside its children.** A column packed from
 * the top would put a parent only as far down as the nodes above it in its
 * column, however far down its children are, and a big tree's arrows
 * would fan out long and crossing. Here every subtree takes a band of its
 * own, its subtrees stacked one under another in its edges' order, and its
 * root is centred on its children: the band of a leaf is the leaf, and a
 * parent taller than its children pushes them down to stay centred on
 * them. The arrows between neighbouring ranks are then short, and none
 * crosses another. Roots stack in id order, as a column's nodes do.
 *
 * A graph is a tree here when no node is the target of two edges and
 * every edge goes to the next rank, so no edge needs a lane. Any other
 * graph — a node shared by two parents, or an edge that skips a rank —
 * normally keeps its columns packed from the top: a shared node has no one
 * parent to sit beside. `Graph.centerColumns` can align their nodes with
 * incoming connections instead. **Every node gets a top**: with one incoming
 * edge at most, and each edge one rank right, no edge can close a cycle, so every
 * node is reached from exactly one root.
 *
 * **Two passes over the ranks, not a walk down each subtree**, so a deep
 * tree does not need a deep stack: right to left, each node's band —
 * its height, how far its own top sits below the band's, and how far its
 * children are pushed down — from its children's, all one rank right;
 * then left to right, each band's top from its parent's.
 *
 * @type {(ranks: readonly (readonly number[])[]) => (edges: readonly Edge[]) => (rankOf: (id: number) => number) => (sizeOf: (id: number) => _Size) => (childrenOf: (id: number) => readonly number[]) => ReadonlyMap<number, number> | null}
 */
const treeTopsOf = ranks => edges => rankOf => sizeOf => childrenOf => {
    const toNodes = edges.flatMap(({ from, to }) => typeof to === 'number' ? [{ from, to }] : [])
    const targets = new Set(toNodes.map(({ to }) => to))
    if (targets.size !== toNodes.length || toNodes.some(({ from, to }) => rankOf(to) !== rankOf(from) + 1)) { return null }
    /** @typedef {{ readonly band: number, readonly top: number, readonly shift: number }} Band */
    /** @type {StateScan<readonly number[], ReadonlyMap<number, Band>, readonly (readonly [number, Band])[]>} */
    const bandsOf = (column, right) => {
        /** @type {(id: number) => Band} */
        const at = id => /** @type {Band} */ (right.get(id))
        const bands = column.map(id => {
            const { height } = sizeOf(id)
            const children = childrenOf(id)
            if (children.length === 0) { return /** @type {const} */ ([id, { band: height + nodeGap, top: 0, shift: 0 }]) }
            const last = children[children.length - 1]
            const above = children.slice(0, -1).reduce((sum, child) => sum + at(child).band, 0)
            const y = (at(children[0]).top + above + at(last).top + sizeOf(last).height - height) / 2
            const shift = max(0, -y)
            const band = max(above + at(last).band + shift, y + shift + height + nodeGap)
            return /** @type {const} */ ([id, { band, top: y + shift, shift }])
        })
        return [bands, new Map(bands)]
    }
    const bands = new Map(toArray(stateScan(bandsOf)(new Map())(ranks.toReversed())).flat())
    const bandOf = /** @type {(id: number) => Band} */ (id => /** @type {Band} */ (bands.get(id)))
    /** @type {StateScan<number, number, readonly [number, number]>} */
    const stackRoot = (id, next) => [[id, next], next + bandOf(id).band]
    const roots = new Map(toArray(stateScan(stackRoot)(margin)(ranks.flat().filter(id => !targets.has(id)).toSorted((a, b) => a - b))))
    /** @type {StateScan<readonly number[], ReadonlyMap<number, number>, readonly (readonly [number, number])[]>} */
    const topsOf = (column, from) => {
        /** @type {(id: number) => number} */
        const bandTopOf = id => /** @type {number} */ (from.get(id) ?? roots.get(id))
        /** @type {StateScan<number, number, readonly [number, number]>} */
        const stackChild = (child, next) => [[child, next], next + bandOf(child).band]
        return [
            column.map(id => /** @type {const} */ ([id, bandTopOf(id) + bandOf(id).top])),
            new Map(column.flatMap(id => toArray(stateScan(stackChild)(bandTopOf(id) + bandOf(id).shift)(childrenOf(id))))),
        ]
    }
    return new Map(toArray(stateScan(topsOf)(new Map())(ranks)).flat())
}

/**
 * Each back edge's {@link _BackLane}, by its index, from the ranks it goes
 * from and to and the height `y` it leaves its node at.
 *
 * **A narrower back edge takes a lane nearer the graph**, and nearer its
 * columns in the gaps it goes down and up, so a back edge whose ranks lie
 * strictly inside another's is drawn inside it and the two never cross.
 * **Of two that span equally many ranks, the lower one is nearer**: going
 * down one gap, the higher one then passes right of where the lower one
 * leaves its node rather than across it. Back edges that share a gap and
 * nest the other way can still cross there, where no order of lanes
 * would keep them apart.
 *
 * With bundling, edges returning to the same node with the same kind share
 * a bottom lane and a return into that node. A source column also shares
 * its descent for those edges. Each complete route is kept for tracing.
 *
 * @type {(edges: readonly _BackEdge[], bundle: boolean) => ReadonlyMap<number, _BackLane>}
 */
const backLanesOf = (edges, bundle) => {
    const groups = edges.reduce(
        /** @type {(groups: readonly (readonly _BackEdge[])[], edge: _BackEdge) => readonly (readonly _BackEdge[])[]} */
        ((groups, edge) => {
            const found = bundle ? groups.findIndex(g => sameReturn(g[0], edge)) : -1
            return found === -1 ? [...groups, [edge]] : groups.map((g, i) => i === found ? [...g, edge] : g)
        }), [])
    const backs = groups.map(edges => ({ edges, from: maxOf(edges.map(e => e.from)), to: edges[0].to, y: maxOf(edges.map(e => e.y)) }))
        .toSorted((a, b) => (a.from - a.to) - (b.from - b.to) || b.y - a.y)
    return new Map(backs.flatMap(({ edges }, lane) => edges.map(({ index, from, to }) => [index, {
        lane,
        out: backs.slice(0, lane).filter(b => b.edges.some(e => e.from === from)).length,
        into: backs.slice(0, lane).filter(b => b.to === to).length,
    }])))
}

/** @type {(a: Pick<_BackEdge, 'target' | 'kind'>, b: Pick<_BackEdge, 'target' | 'kind'>) => boolean} */
const sameReturn = (a, b) => a.target === b.target && a.kind === b.kind

/**
 * Fit preferred slot tops into a column without overlaps or reordering.
 * Subtracting the packed offsets turns the spacing constraints into a
 * nondecreasing sequence. Pool adjacent violations by averaging them,
 * then clamp to the column's available slack. This minimizes squared
 * displacement from the preferred tops, including routing lanes.
 *
 * @type {(desired: readonly number[], offsets: readonly number[], slack: number) => readonly number[]}
 */
const fittedTops = (desired, offsets, slack) => {
    /** @typedef {{ readonly sum: number, readonly count: number }} Pool */
    const pools = desired.reduce(
        /** @type {(pools: readonly Pool[], top: number, index: number) => readonly Pool[]} */
        ((pools, top, index) => {
            let rest = pools
            let pool = { sum: top - offsets[index], count: 1 }
            while (rest.length !== 0) {
                const last = rest[rest.length - 1]
                if (last.sum / last.count <= pool.sum / pool.count) { break }
                pool = { sum: pool.sum + last.sum, count: pool.count + last.count }
                rest = rest.slice(0, -1)
            }
            return [...rest, pool]
        }), [])
    return pools.flatMap(({ sum, count }) => Array.from({ length: count }, () => max(margin, min(margin + slack, sum / count))))
        .map((top, i) => top + offsets[i])
}

/** @type {(node: _Positioned) => readonly (readonly [number, number])[]} */
const edgeHeightsOf = node => [
    ...node.ports.map(port => /** @type {const} */ ([port.index, node.y + port.y + portHeight / 2])),
    ...node.exits.map(exit => /** @type {const} */ ([exit.index, node.y + exit.y])),
]

/** @type {StateScan<_Sized, number, number>} */
const offsetOf = ({ size }, offset) => [offset, offset + (size === null ? laneSize : size.height) + nodeGap]

/**
 * Every column, left to right: its nodes and lanes in `key` order, each
 * placed top to bottom, and the column as wide as its widest node. A lane
 * spans its column's whole width, so the next column starts right of it
 * and right of any node alike.
 *
 * A node is its label and a row per port right of it, as {@link portsOf} lays
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
 * **A tree's nodes take the tops {@link treeTopsOf} gives them** instead
 * of the running `y`; a tree has no lanes. Back edges do not count: a graph
 * that is a tree but for them is drawn as one.
 *
 * **Column centering is opt-in.** For a non-tree, `Graph.centerColumns`
 * starts roots at the column midpoint, then places each node near the mean
 * height of its incoming forward connections. Skip-rank lanes follow the
 * preceding segment. Each column is fitted into the tallest packed column,
 * preserving slot order and clearance; crowded slots compromise on their
 * preferred positions. Back edges do not influence placement. A tree keeps
 * its parent/child centering instead.
 *
 * **A back edge has no lane in any column.** It goes down a gap, along the
 * bottom and up another gap ({@link routesOf}), so a gap is wider by a lane
 * for each back edge that goes down or up it. Bundled returns reserve
 * one such lane per destination and edge kind in each gap they use.
 *
 * The first column starts at `left`.
 *
 * @type {(left: number) => (nodes: readonly Ranked[]) => (edges: readonly Edge[], bundle: boolean, center: boolean) => _Placed}
 */
const layout = left => nodes => (edges, bundle, center) => {
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
    const labels = new Map(nodes.map(n => [n.id, n.label]))
    const outgoing = new Map(nodes.map(n => [n.id,
        edges.flatMap((edge, index) => edge.from === n.id
            ? [{ edge, index, target: typeof edge.to === 'number' ? /** @type {string} */ (labels.get(edge.to)) : '' }]
            : [])]))
    const outgoingOf = /** @type {(id: number) => readonly _Out[]} */ (id => /** @type {readonly _Out[]} */ (outgoing.get(id)))
    const ranks = new Map(nodes.map(n => [n.id, n.rank]))
    const rankOf = /** @type {(id: number) => number} */ (id => /** @type {number} */ (ranks.get(id)))
    const spans = edges.map(({ from, to, back }) =>
        ({ from: rankOf(from), to: typeof to === 'number' && back !== true ? rankOf(to) : rankOf(from), key: from + 0.5 }))
    // A back edge's ranks, from and to, which its route needs a gap at.
    const backRanks = edges.flatMap(({ from, to, back, kind }, index) =>
        back === true && typeof to === 'number' ? [{ index, from: rankOf(from), to: rankOf(to), target: to, kind }] : [])
    // the back edges going down the gap left of `rank`'s column, or up it
    /** @type {(rank: number) => number} */
    const gapOf = rank => laneSize * backRanks.filter(({ from, to }) => from + 1 === rank || to === rank)
        .filter((back, i, all) => !bundle || all.findIndex(b => sameReturn(b, back)) === i).length
    const maxRank = nodes.reduce((m, n) => max(m, n.rank), 0)
    const sizes = new Map(nodes.map(n => [n.id, portsOf(n)(outgoingOf(n.id))]))
    const sizeOf = /** @type {(id: number) => _Size} */ (id => /** @type {_Size} */ (sizes.get(id)))
    /** @type {readonly (readonly _Slot[])[]} */
    const columns = Array.from({ length: maxRank + 1 }, (_, rank) => [
        ...nodes.filter(node => node.rank === rank).map(node => ({ node, rank, key: node.id })),
        ...spans.flatMap((span, lane) => span.from < rank && rank < span.to ? [{ lane, rank, key: span.key }] : []),
    ].toSorted((a, b) => a.key - b.key))
    const treeTops = treeTopsOf(columns.map(column => column.flatMap(slot => slot.node === undefined ? [] : [slot.node.id])))(edges.filter(e => e.back !== true))(rankOf)(sizeOf)(
        id => outgoingOf(id).flatMap(({ edge }) => typeof edge.to === 'number' && edge.back !== true ? [edge.to] : []))
    const align = center && treeTops === null
    // Include the lanes between nodes: centering boxes alone would leave
    // their skip-rank routes in positions that can pass through a box.
    const columnHeights = columns.map(column => max(0, column.reduce((height, slot) =>
        height + (slot.node === undefined ? laneSize : sizeOf(slot.node.id).height) + nodeGap, 0) - nodeGap))
    const tallest = maxOf(columnHeights)
    /** @type {(left: number) => (widest: number) => (sized: _Sized, top: number) => _PlacedSlot} */
    const placeSlot = left => widest => ({ slot, size }, top) => {
        if (size === null) {
            /** @type {_Lane} */
            const lane = { index: /** @type {number} */ (slot.lane), rank: slot.rank, y: top + laneSize / 2, left, right: left + widest }
            return { lane }
        }
        const id = /** @type {Ranked} */ (slot.node).id
        /** @type {_Positioned} */
        const node = { .../** @type {Ranked} */ (slot.node), x: left, y: treeTops === null ? top : /** @type {number} */ (treeTops.get(id)), ...size }
        return { node }
    }
    /** @typedef {{ readonly left: number, readonly heights: ReadonlyMap<number, number> }} ColumnState */
    /** @type {StateScan<readonly [number, readonly _Slot[]], ColumnState, _Column>} */
    const placeColumn = ([rank, column], prior) => {
        const left = prior.left + gapOf(rank)
        const sized = column.map(slot => ({ slot, size: slot.node === undefined ? null : sizeOf(slot.node.id) }))
        const widest = sized.reduce((m, { size }) => max(m, size === null ? laneSize : size.width), 0)
        const top = margin + (align ? (tallest - columnHeights[rank]) / 2 : 0)
        const offsets = toArray(stateScan(offsetOf)(0)(sized))
        const tops = align ? fittedTops(sized.map(({ slot, size }, i) => {
            const incoming = size === null ? [prior.heights.get(/** @type {number} */ (slot.lane))]
                : edges.flatMap(({ to, back }, index) => to === /** @type {Ranked} */ (slot.node).id && back !== true ? [prior.heights.get(index)] : [])
            const heights = incoming.filter(h => h !== undefined)
            return heights.length === 0 ? top + offsets[i]
                : heights.reduce((sum, y) => sum + y, 0) / heights.length - (size === null ? laneSize : size.height) / 2
        }), offsets, tallest - columnHeights[rank]) : offsets.map(offset => top + offset)
        const place = placeSlot(left)(widest)
        const slots = sized.map((sized, i) => place(sized, tops[i]))
        const heights = align ? slots.flatMap(({ node, lane }) => node === undefined
            ? [/** @type {const} */ ([/** @type {_Lane} */ (lane).index, /** @type {_Lane} */ (lane).y])]
            : edgeHeightsOf(node)) : []
        return [{ end: left + widest, slots }, { left: left + widest + rankGap, heights: new Map([...prior.heights, ...heights]) }]
    }
    const placedColumns = toArray(stateScan(placeColumn)({ left, heights: new Map() })(columns.map((column, rank) => /** @type {const} */ ([rank, column]))))
    const placed = placedColumns.flatMap(column => column.slots)
    const placedNodes = placed.flatMap(p => p.node === undefined ? [] : [p.node])
    // where each edge leaves its node, from the top of the graph
    const heights = new Map(placedNodes.flatMap(edgeHeightsOf))
    return {
        nodes: placedNodes,
        lanes: placed.flatMap(p => p.lane === undefined ? [] : [p.lane]),
        ends: placedColumns.map(column => column.end),
        backs: backLanesOf(backRanks.map(back => ({ ...back, y: /** @type {number} */ (heights.get(back.index)) })), bundle),
    }
}

/**
 * Every edge's route but an inline one's: from the right end of its port,
 * straight right to its column's edge where its node is narrower than the
 * column, straight across its lane in each rank it skips, and to the middle
 * of its target's left side. Nodes and lanes are looked up, not searched for,
 * for the reason {@link layout} gives.
 *
 * **The run to the column's edge is what lets a node keep its own
 * width.** An edge leaving a narrow node turned at once would cut across
 * a wider neighbour above or below it on its way to the next column;
 * running right first, it turns only in the gap between columns, where
 * there are no boxes.
 *
 * **A back edge goes around the graph, not through it**: right from its
 * port into the gap after its column, down to its lane below every node
 * and lane, left along it to the gap before its target's column, and up
 * into the middle of its target's left side. It turns only in gaps and
 * below the graph, so it crosses no box either, and its lane keeps it off
 * every other return group ({@link backLanesOf}). Bundled edges meet at
 * the same bottom lane and share the run into their target. With separate
 * routing, return entry points spread down the target in gap order: the
 * outermost route enters highest, keeping these final segments distinct.
 *
 * @type {(placed: _Placed, separate?: boolean) => readonly _Route[]}
 */
const routesOf = (placed, separate = false) => {
    const byId = new Map(placed.nodes.map(p => [p.id, p]))
    const at = /** @type {(id: number) => _Positioned} */ (id => /** @type {_Positioned} */ (byId.get(id)))
    const lanes = new Map(placed.lanes.map(lane => [`${lane.index} ${lane.rank}`, lane]))
    const bottom = maxOf([...placed.nodes.map(p => p.y + p.height), ...placed.lanes.map(lane => lane.y + laneSize / 2)])
    const targets = new Map(placed.nodes.flatMap(node => [...node.ports, ...node.exits].map(({ index, edge }) => [index, edge.to])))
    const entries = new Map(separate ? placed.nodes.flatMap(({ id }) => {
        const returning = [...placed.backs].filter(([index]) => targets.get(index) === id)
            .toSorted((a, b) => b[1].into - a[1].into)
        return returning.map(([index], i) => /** @type {const} */ ([index, (i + 1) / (returning.length + 1)]))
    }) : [])
    /** @type {(from: _Positioned) => readonly (readonly [_Out, number])[]} */
    const leaving = from => [
        ...from.ports.map(port => /** @type {const} */ ([port, port.y + portHeight / 2])),
        ...from.exits.map(exit => /** @type {const} */ ([exit, exit.y])),
    ]
    return placed.nodes.flatMap(from => leaving(from).flatMap(([port, offset]) => {
        const target = port.edge.to
        if (typeof target !== 'number') { return [] }
        const to = at(target)
        const y = from.y + offset
        const right = from.x + from.width
        const middle = to.y + to.height / 2
        /** @type {(back: _BackLane) => readonly _Point[]} */
        const around = ({ lane, out, into }) => {
            const down = placed.ends[from.rank] + laneSize * (out + 1)
            const up = to.x - laneSize * (into + 1)
            const below = bottom + laneSize * (lane + 1)
            const entry = separate ? to.y + to.height * assertNotNullish(entries.get(port.index)) : middle
            return [[right, y], [down, y], [down, below], [up, below], [up, entry], [to.x, entry]]
        }
        const back = placed.backs.get(port.index)
        /** @type {readonly _Point[]} */
        const points = back !== undefined ? around(back) : [
            [right, y],
            ...(right < placed.ends[from.rank] ? [/** @type {_Point} */ ([placed.ends[from.rank], y])] : []),
            ...Array.from({ length: to.rank - from.rank - 1 }, (_, i) => {
                const lane = /** @type {_Lane} */ (lanes.get(`${port.index} ${from.rank + 1 + i}`))
                return /** @type {readonly _Point[]} */ ([[lane.left, lane.y], [lane.right, lane.y]])
            }).flat(),
            [to.x, middle],
        ]
        return [{ edge: port.edge, index: port.index, to: target, points }]
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
            : p < 0 ? [max(lo, q / p), hi]
                : [lo, min(hi, q / p)],
        /** @type {readonly [number, number]} */ ([0, 1]))
    return t0 < t1
}

/**
 * `g` laid out, with room left of the first column for its entries' arrows
 * when it has any. **An entry must name a node of the graph**, for the
 * reason an edge must ({@link layout}): an arrow into nothing would simply
 * vanish. **And no node takes two**: they would be drawn one over the
 * other, which reads as one. **A value's parts must spell it**, and an
 * edge from a corner, which has no row, must have no label or value.
 *
 * **A node's arrows leave from its corners or from its rows, never both.**
 * The middle of a node with an odd number of rows is its middle row's, so
 * a `middle` corner and that row's arrow would start at one point, and to
 * one target they would be one line: two edges drawn as one. No demo mixes
 * the two — a child of a tree is a corner and a row is a value — so the
 * graph is refused rather than given room for both.
 *
 * **A node's groups must take its rows**, every one of them and at least
 * one each: a row left over would have no cell beside it, and a group with
 * no row would be a cell with no height.
 *
 * @type {(g: Graph) => _Placed}
 */
const placedOf = ({ nodes, edges, entries = [], backRouting, centerColumns = false }) => {
    const ids = new Set(nodes.map(n => n.id))
    const missing = entries.findIndex(({ to }) => !ids.has(to))
    if (missing !== -1) { throw `graph: entry ${missing} ends at node ${entries[missing].to}, which is not in the graph` }
    const repeated = entries.findIndex(({ to }, i) => entries.findIndex(e => e.to === to) !== i)
    if (repeated !== -1) { throw `graph: entry ${repeated} ends at node ${entries[repeated].to}, which another entry already does` }
    // A value drawn in parts must spell the value it sizes its cell by:
    // otherwise the cell would be measured for one text and show another.
    const misspelt = edges.findIndex(({ to }) => typeof to !== 'number' && to.parts !== undefined && to.parts.map(([text]) => text).join('') !== to.inline)
    if (misspelt !== -1) { throw `graph: edge ${misspelt}'s parts do not spell its value` }
    // An edge leaving from a corner has no row to hold a label or a value.
    const cornered = edges.findIndex(({ corner, to, label }) => corner !== undefined && (typeof to !== 'number' || label !== ''))
    if (cornered !== -1) { throw `graph: edge ${cornered} leaves from a corner, so it must end at a node and have no label` }
    const fromCorners = new Set(edges.flatMap(({ from, corner }) => corner === undefined ? [] : [from]))
    const mixed = edges.findIndex(({ from, to, corner }) => corner === undefined && typeof to === 'number' && fromCorners.has(from))
    if (mixed !== -1) { throw `graph: edge ${mixed} leaves a row of node ${edges[mixed].from}, whose other arrows leave from its corners` }
    const misgrouped = nodes.find(({ id, groups }) => groups !== undefined && (
        groups.some(([, rows]) => rows < 1)
        || groups.reduce((n, [, rows]) => n + rows, 0) !== edges.filter(e => e.from === id && e.corner === undefined).length))
    if (misgrouped !== undefined) { throw `graph: node ${misgrouped.id}'s groups do not take its rows, at least one each` }
    return layout(margin + (entries.length === 0 ? 0 : entryLength))(nodes)(edges, backRouting === 'shared', centerColumns)
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
    return routesOf(placed, g.backRouting === 'separate').reduce((n, { points }) =>
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
 * The cells of a node's label column: one per group, each beside its own
 * rows, `y` measured from the node's top edge — or none, for a node
 * without groups, whose label is the one column.
 *
 * @type {(p: _Positioned) => readonly { readonly label: string, readonly y: number, readonly height: number }[]}
 */
const groupCellsOf = ({ groups = [] }) => toArray(stateScan(
    /** @type {StateScan<readonly [string, number], number, { readonly label: string, readonly y: number, readonly height: number }>} */
    (([label, rows], row) => [{ label, y: row * portHeight, height: rows * portHeight }, row + rows]))(0)(groups))

/** @type {(p: _Positioned) => (attrs: Readonly<Record<string, string>>) => readonly Element[]} */
const titleTraceOf = p => attrs => p.title === 0 ? [] : [/** @type {Element} */ (['rect', {
    x: String(p.x), y: String(p.y), width: String(p.title), height: String(p.height), rx: String(radius),
    'data-graph-trace': '', ...attrs,
}])]

/**
 * A graph, drawn: a node per {@link Ranked}, an edge per {@link Edge},
 * ranked by longest path from the root, left to right.
 *
 * **Every edge leaves from a port of its own.** A node with outgoing
 * edges draws a row right of its label per edge, each holding that edge's
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
 * **Tracing is opt-in.** `Graph.trace` makes each complete connection a
 * native focus target with a wider transparent hit area. Hover or focus
 * highlights its route, source port and destination title; clicking gives it persistent
 * focus, and Tab moves to the next connection. Bundled returns keep every
 * logical route so one source can still be followed through a shared run.
 * Hovering a reference cell traces that route and outlines only that cell;
 * its adjacent key is inactive. A port without a separate reference cell
 * keeps its single-cell interaction.
 * Hovering a node name traces only its incoming connections and their
 * source ports. Nodes without visible port cells use their title block.
 * The SVG's own CSS relationships use numeric identities,
 * not display names.
 *
 * @type {(g: Graph) => Element}
 */
export const graphSvg = g => {
    const placed = placedOf(g)
    const positioned = placed.nodes
    const routes = routesOf(placed, g.backRouting === 'separate')
    // A back edge's route is the one thing outside every node and lane.
    const corners = routes.flatMap(({ points }) => points)
    const width = margin + maxOf([
        ...positioned.map(p => p.x + p.width),
        ...placed.lanes.map(lane => lane.right),
        ...corners.map(([x]) => x),
    ])
    const height = margin + maxOf([
        ...positioned.map(p => p.y + p.height),
        ...placed.lanes.map(lane => lane.y + laneSize / 2),
        ...corners.map(([, y]) => y),
    ])
    /** @type {(id: number) => _Positioned} */
    const nodeOf = id => assertNotNullish(positioned.find(n => n.id === id))
    const fade = fadeOf(nodeOf)
    const keyed = positioned.some(p => p.key !== undefined)
    // A keyed graph's routes all have one more point than their bend, a
    // straight run doubled, so one route's shape can slide into another's.
    /** @type {(points: readonly _Point[]) => readonly _Point[]} */
    const even = points => keyed && points.length === 2 ? [points[0], ...points] : points
    // An edge's slot among the edges leaving its node tells two edges
    // between the same nodes apart.
    /** @type {(index: number, from: number) => number} */
    const slotOf = (index, from) => g.edges.slice(0, index).filter(e => e.from === from).length
    /** @type {readonly Element[]} */
    const edgeEls = routes.map(({ edge, index, to, points }) => {
        const from = nodeOf(edge.from)
        const target = nodeOf(to)
        const d = `M${even(points).map(([x, y]) => `${x},${y}`).join(' L')}`
        // Bundled paths overlap on their shared return. Only one draws the
        // arrowhead, but every complete logical path remains traceable.
        const arrow = g.backRouting !== 'shared' || edge.back !== true
            || !routes.some(r => r.index < index && r.edge.back === true && r.to === to && r.edge.kind === edge.kind)
        const line = /** @type {Element} */ (['path', {
            d, 'data-graph-edge': '',
            ...(arrow ? { 'marker-end': 'url(#graph-arrow)' } : {}),
            ...(edge.kind === undefined ? {} : { 'data-graph-edge-kind': edge.kind }),
            ...fade(edge.from, to),
            ...pathKeyOf('edge', from.key, String(slotOf(index, edge.from)), target.key),
        }])
        if (g.trace !== true) { return line }
        const sourcePorts = from.ports.filter(port => port.index === index && from.title < from.width)
        const description = `${from.label} [${edge.label}] → ${target.label}${edge.back === true ? ' (recursive)' : ''}`
        return /** @type {Element} */ (['g', {
            'data-graph-connection': String(index), tabindex: '0', role: 'group', 'aria-label': description,
            'data-graph-from': String(edge.from), 'data-graph-to': String(to),
            ...pathKeyOf('connection', from.key, String(slotOf(index, edge.from)), target.key),
        },
            ['title', description],
            line,
            ['path', { d, 'data-graph-hit': '' }],
            ['path', { d, 'data-graph-trace': '', 'marker-end': 'url(#graph-trace-arrow)' }],
            ...titleTraceOf(target)({ 'data-graph-title-outline': String(to) }),
            ...(sourcePorts.length === 0 && edge.from !== to ? titleTraceOf(from)({ 'data-graph-title-outline': String(edge.from) }) : []),
            ...sourcePorts.map(port => {
                const key = port.ref === null ? 0 : keyWidthOf(from)(port)
                return /** @type {Element} */ (['rect', {
                    x: String(from.x + from.title + key), y: String(from.y + port.y),
                    width: String(from.width - from.title - key), height: String(portHeight),
                    'data-graph-trace': '', 'data-graph-port-outline': String(index),
                }])
            }),
        ])
    })
    const entries = g.entries ?? []
    // An entry runs straight right into its node, level with where an edge
    // would arrive.
    /** @type {readonly Element[]} */
    const entryEls = positioned.flatMap(p => entries.filter(({ to }) => to === p.id).map(({ kind }) => {
        const y = p.y + p.height / 2
        return /** @type {Element} */ (['path', {
            d: `M${p.x - entryLength},${y} L${p.x},${y}`,
            'data-graph-edge': '', 'data-graph-entry': '', 'marker-end': 'url(#graph-arrow)',
            ...(kind === undefined ? {} : { 'data-graph-edge-kind': kind }),
            ...fade(p.id, p.id),
            ...pathKeyOf('entry', p.key),
        }])
    }))
    /** @type {(port: _Port) => { readonly 'data-graph-port-edge'?: string }} */
    const portAttrOf = port => g.trace === true && typeof port.edge.to === 'number'
        ? { 'data-graph-port-edge': String(port.index) } : {}
    /** @type {(port: _Port) => { readonly 'data-graph-port-edge'?: string }} */
    const keyPortAttrOf = port => port.ref === null ? portAttrOf(port) : {}
    /** @type {(id: number) => { readonly 'data-graph-node-name'?: string }} */
    const nameAttrOf = id => g.trace === true ? { 'data-graph-node-name': String(id) } : {}
    // A keyed graph draws its keyed groups in an order of their own, by
    // key, in a layer each: a page that patches it then finds a node's
    // group among the same siblings, in the same order, from one drawing
    // to the next, and never has to move it. Its edges are a layer too,
    // sorted by key the same way, so the label layer after them stays the
    // same element however many edges a drawing has, and an edge between
    // nodes that stay is the same path, its route sliding with them.
    /** @type {(el: Element) => string} */
    const keyAttrOf = el => /** @type {{ readonly 'data-key'?: string }} */ (/** @type {readonly unknown[]} */ (el)[1])['data-key'] ?? ''
    /** @type {(els: readonly Element[]) => readonly Element[]} */
    const byKey = els => keyed ? els.toSorted((a, b) => keyAttrOf(a) < keyAttrOf(b) ? -1 : 1) : els
    const drawn = keyed ? positioned.toSorted((a, b) => String(a.key) < String(b.key) ? -1 : 1) : positioned
    /** @type {(els: readonly Element[]) => readonly Element[]} */
    const layer = els => keyed ? [['g', ...els]] : els
    /** @type {readonly Element[]} */
    const boxEls = drawn.map(at => {
        const { local: p, group } = placeOf(at)
        return /** @type {Element} */ (['g', { ...inKindOf(p), ...group('box') },
        /** @type {Element} */ (['rect', {
            x: String(p.x), y: String(p.y), width: String(p.width), height: String(p.height), rx: String(radius),
            'data-graph-node': '', 'data-graph-kind': p.kind,
        }]),
        ...(p.ports.length === 0 ? [] : [/** @type {Element} */ (['g', { 'clip-path': `url(#${clipIdOf(at)})` },
            ...groupCellsOf(p).map(cell => /** @type {Element} */ (['rect', {
                x: String(p.x), y: String(p.y + cell.y), width: String(p.title), height: String(cell.height),
                'data-graph-group': '',
            }])),
            ...p.ports.flatMap(port => keyWidthOf(p)(port) === 0 ? [] : [/** @type {Element} */ (['rect', {
                x: String(p.x + p.title), y: String(p.y + port.y),
                width: String(keyWidthOf(p)(port)), height: String(portHeight),
                'data-graph-port': '',
                ...keyPortAttrOf(port),
            }])]),
            ...p.ports.flatMap(port => valueOf(port) === null ? [] : [/** @type {Element} */ (['rect', {
                x: String(p.x + p.title + keyWidthOf(p)(port)), y: String(p.y + port.y),
                width: String(p.width - p.title - keyWidthOf(p)(port)), height: String(portHeight),
                'data-graph-value': '',
                ...portAttrOf(port),
                // A value with no key is the whole row: marked, so a
                // stylesheet can leave it unfilled where a tint across
                // every row would hide the node's own fill.
                ...(keyWidthOf(p)(port) === 0 ? { 'data-graph-value-alone': '' } : {}),
                ...refAttrOf(port),
                ...valueKindOf(port.edge),
                // An edge carries its kind on its line; a value has no
                // line, so its cell carries the kind instead.
                ...(port.ref !== null || port.edge.kind === undefined ? {} : { 'data-graph-edge-kind': port.edge.kind }),
                ...clickOf(port.edge),
            }])]),
        ]),
        // The node's border again, over its cells: their thinner lines
        // would otherwise draw over the inner half of it.
        /** @type {Element} */ (['rect', {
            x: String(p.x), y: String(p.y), width: String(p.width), height: String(p.height), rx: String(radius),
            'data-graph-outline': '',
        }])]),
        ...(g.trace === true ? titleTraceOf(p)({ 'data-graph-title-hover': String(p.id) }) : []),
        ])
    })
    /** @type {readonly Element[]} */
    const clipEls = positioned.flatMap(at => {
        const { local: p } = placeOf(at)
        return p.ports.length === 0 ? [] : [/** @type {Element} */ (['clipPath', { id: clipIdOf(at) },
            ['rect', { x: String(p.x), y: String(p.y), width: String(p.width), height: String(p.height), rx: String(radius) }]])]
    })
    /** @type {readonly Element[]} */
    const labelEls = drawn.map(at => {
        const { local: p, group } = placeOf(at)
        return /** @type {Element} */ (['g', { ...inKindOf(p), ...group('text') },
        ...(p.groups !== undefined
            ? groupCellsOf(p).map(cell => /** @type {Element} */ (['text', {
                x: String(p.x + p.title / 2), y: String(p.y + cell.y + cell.height / 2),
                'text-anchor': 'middle', 'data-graph-label': '',
                ...nameAttrOf(p.id),
            }, cell.label]))
            : p.label === '' ? [] : [/** @type {Element} */ (['text', {
                x: String(p.x + p.title / 2), y: String(p.y + p.height / 2),
                'text-anchor': 'middle', 'data-graph-label': '',
                ...nameAttrOf(p.id),
            }, p.label])]),
        ...p.ports.flatMap(port => keyWidthOf(p)(port) === 0 ? [] : [/** @type {Element} */ (['text', {
            x: String(p.x + p.title + keyWidthOf(p)(port) / 2), y: String(p.y + port.y + portHeight / 2),
            'text-anchor': 'middle', 'data-graph-edge-label': '',
            ...keyPortAttrOf(port),
        }, port.edge.label])]),
        ...p.ports.flatMap(port => {
            const { to } = port.edge
            const at = {
                x: String(p.x + (p.title + keyWidthOf(p)(port) + p.width) / 2), y: String(p.y + port.y + portHeight / 2),
                'text-anchor': 'middle', 'data-graph-value-label': '',
            }
            return port.ref !== null ? [/** @type {Element} */ (['text', { ...at, ...refAttrOf(port), ...portAttrOf(port) }, port.ref])]
                : typeof to === 'number' ? [] : [/** @type {Element} */ (['text', {
                ...at,
                ...valueKindOf(port.edge),
                ...(to.click === undefined ? {} : { 'pointer-events': 'none' }),
            }, ...(to.parts === undefined ? [to.inline]
                : to.parts.map(([text, kind]) => /** @type {Element} */ (['tspan', { 'data-graph-part': kind }, text])))])]
        }),
        ])
    })
    return ['div', { 'data-graph': '', ...(g.trace === true ? { tabindex: '-1' } : {}) }, ['svg', { viewBox: `0 0 ${width} ${height}`, width: String(width), height: String(height) },
        ...(g.trace === true ? [/** @type {Element} */ (['style', { 'data-graph-trace-style': '' },
            // Numeric identities keep the selectors independent of labels.
            // Each :has is scoped to its SVG, so equal ids in another graph
            // on the same page do not share a hover state.
            ...positioned.map(p => `svg:has([data-graph-node-name="${p.id}"]:hover) [data-graph-to="${p.id}"] [data-graph-trace] { opacity: 1 }\n`),
            ...positioned.map(p => `svg:has([data-graph-node-name="${p.id}"]:hover) [data-graph-title-hover="${p.id}"] { opacity: 1 }\n`),
            ...routes.map(r => `svg:has([data-graph-port-edge="${r.index}"]:hover) [data-graph-connection="${r.index}"] [data-graph-trace] { opacity: 1 }\n`),
        ])] : []),
        ['defs',
            ['marker', {
                id: 'graph-arrow', viewBox: '0 0 10 10', refX: '9', refY: '5',
                markerWidth: '6', markerHeight: '6', orient: 'auto',
            },
                ['path', { d: 'M0,0 L10,5 L0,10 z', 'data-graph-arrow': '' }]],
            ...(g.trace === true ? [/** @type {Element} */ (['marker', {
                id: 'graph-trace-arrow', viewBox: '0 0 10 10', refX: '9', refY: '5',
                markerWidth: '6', markerHeight: '6', orient: 'auto',
            }, ['path', { d: 'M0,0 L10,5 L0,10 z', 'data-graph-trace-arrow': '' }]])] : []),
            ...clipEls],
        ...layer(boxEls),
        ...layer(byKey([...edgeEls, ...entryEls])),
        ...layer(labelEls),
    ]]
}
