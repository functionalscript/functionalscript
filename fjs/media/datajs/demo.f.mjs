/**
 * A DataJS document as the graph it denotes: type one, see its nodes and
 * edges — sharing included. Two keys pointing at the same array are one
 * node with two incoming edges, not two nodes that happen to look alike.
 *
 * **The one thing plain JSON cannot show.** [The JSON demo](../json/demo.f.mjs)
 * shows a round trip; JSON has no way to write two references to the same
 * value, so there is nothing there to draw as a graph. A DataJS `const` is
 * the one part of this format whose entire job is spelling sharing, and
 * this demo draws exactly what [the specification](../../../spec/datajs/README.md)
 * says every document denotes: a directed acyclic graph.
 *
 * **A container gets one node per distinct reference; a leaf gets one node
 * per occurrence** — "primitive sharing is not [written]", in the
 * specification's own words. Reference identity, checked with `Object.is`,
 * is what a parsed value already carries: this walk reads it rather than
 * reconstructing it.
 *
 * **A node's rank is the longest path from the root, not the first one the
 * walk happened to take**, left to right within a rank in creation order. A
 * shared node reached again from a longer route moves down to match, so
 * every edge points down by at least one rank — never sideways, never up.
 * The first version ranked by first discovery instead, and a later edge to
 * an already-placed node could still point backward across the page; this
 * is the fix, not a second layout engine bolted beside the first.
 *
 * **It needs no operations.** Parsing and walking are pure functions of the
 * text, so `update` declares `never` and returns through `pureOk`.
 *
 * @module
 *
 * @import { Primitive, Unknown } from './types.ts'
 * @import { Demo, DemoEvent } from '../../website/demo/types.ts'
 * @import { Element } from '../../media/html/types.ts'
 */

import { tryParse } from './module.f.mjs'
import { keySerialize, leafSerialize } from './serializer/module.f.mjs'
import { concat } from '../../types/string/module.f.mjs'
import { pureOk } from '../../effects/module.f.mjs'

const { is } = Object

/**
 * A node as the walk discovers it — everything but its rank, which is not
 * yet known: a later edge from elsewhere in the document may still demand a
 * longer route to it than the one that created it.
 *
 * @typedef {{
 *   readonly id: number,
 *   readonly kind: 'array' | 'object' | 'leaf',
 *   readonly label: string,
 * }} _Bare
 *
 * @typedef {_Bare & { readonly rank: number }} _Node
 *
 * @typedef {{ readonly from: number, readonly to: number, readonly label: string }} _Edge
 *
 * @typedef {{
 *   readonly refs: readonly (readonly [object, number])[],
 *   readonly nodes: readonly _Bare[],
 *   readonly edges: readonly _Edge[],
 *   readonly next: number,
 * }} _State
 *
 * @typedef {_Node & { readonly x: number, readonly y: number, readonly width: number, readonly height: number }} _Positioned
 *
 * @typedef {
 *   | { readonly ok: true, readonly nodes: readonly _Node[], readonly edges: readonly _Edge[] }
 *   | { readonly ok: false, readonly error: string }
 * } _Graph
 */

/**
 * The id already assigned to `ref`, by the reference it was walked under —
 * a linear scan, which is what a demo-sized document costs to search rather
 * than to index.
 *
 * @type {(state: _State) => (ref: object) => number | null} */
const findRef = state => ref => {
    const found = state.refs.find(([r]) => is(r, ref))
    return found === undefined ? null : found[1]
}

/**
 * `value`'s node id, and the state with `value` and everything under it
 * added — or just the state, when `value` is a reference already walked.
 *
 * Ranks nothing: which rank a node belongs to depends on every edge that
 * reaches it, including ones this walk has not taken yet when it first
 * creates the node, so {@link ranked} decides that afterward, once the
 * whole graph is known.
 *
 * @type {(state: _State) => (value: Unknown) => { readonly id: number, readonly state: _State }}
 */
const walk = state => value => {
    if (value === null || typeof value !== 'object') {
        const id = state.next
        /** @type {_Bare} */
        const node = { id, kind: 'leaf', label: concat(leafSerialize(/** @type {Primitive} */ (value))) }
        return { id, state: { ...state, next: id + 1, nodes: [...state.nodes, node] } }
    }
    const existing = findRef(state)(value)
    if (existing !== null) { return { id: existing, state } }
    const id = state.next
    const isArray = value instanceof Array
    /** @type {_Bare} */
    const node = { id, kind: isArray ? 'array' : 'object', label: isArray ? '[ ]' : '{ }' }
    /** @type {readonly [object, number]} */
    const ref = [value, id]
    /** @type {_State} */
    const withNode = {
        refs: [...state.refs, ref],
        nodes: [...state.nodes, node],
        edges: state.edges,
        next: id + 1,
    }
    /** @type {(entries: readonly (readonly [string, Unknown])[]) => _State} */
    const walkEntries = entries => entries.reduce(
        /** @type {(acc: _State, entry: readonly [string, Unknown]) => _State} */
        (acc, [label, item]) => {
            const step = walk(acc)(item)
            return { ...step.state, edges: [...step.state.edges, { from: id, to: step.id, label }] }
        },
        withNode)
    const final = isArray
        ? walkEntries(value.map((item, index) => [String(index), item]))
        : walkEntries(Object.entries(value).map(([key, item]) => [concat(keySerialize(key)), item]))
    return { id, state: final }
}

/**
 * Every node's rank: the longest path from the root, so every edge points
 * down by at least one rank and never sideways or up. A node's id is its
 * index here — `walk` assigns ids 0, 1, 2, … in creation order with no
 * gaps — so `current[edge.from]` reads a node by id directly.
 *
 * **Bellman-Ford's relaxation, not a topological sort.** `nodes.length`
 * rounds is more rounds than the longest possible simple path in a graph
 * this size can have edges, which is the bound the algorithm needs; a
 * demo-sized graph has nothing for a sort to save. Each round reads the
 * previous one's ranks only, so the order edges happen to be in does not
 * matter.
 *
 * @type {(nodes: readonly _Bare[], edges: readonly _Edge[]) => readonly _Node[]}
 */
const ranked = (nodes, edges) => {
    /** @type {readonly _Node[]} */
    const initial = nodes.map(n => ({ ...n, rank: n.id === 0 ? 0 : -Infinity }))
    /** @type {(current: readonly _Node[]) => readonly _Node[]} */
    const relax = current => current.map(node => {
        const incoming = edges.filter(e => e.to === node.id)
        const best = incoming.reduce((m, e) => Math.max(m, current[e.from].rank + 1), node.rank)
        return best === node.rank ? node : { ...node, rank: best }
    })
    return Array.from({ length: nodes.length }, () => null).reduce(relax, initial)
}

/**
 * `text` as the graph it denotes, or the parser's own error if it does not
 * denote one.
 *
 * @type {(text: string) => _Graph}
 */
const graphOf = text => {
    const result = tryParse(text)
    if (result[0] === 'error') { return { ok: false, error: result[1] } }
    const { state } = walk({ refs: [], nodes: [], edges: [], next: 0 })(result[1])
    return { ok: true, nodes: ranked(state.nodes, state.edges), edges: state.edges }
}

const nodeHeight = 26
const rowGap = 40
const colGap = 14
const margin = 10
const charWidth = 7

/** @type {(label: string) => number} */
const widthOf = label => Math.max(50, label.length * charWidth + 16)

/**
 * Every node at rank `r`, in the order the walk created them — which is
 * already left-to-right document order, since a rank fills before the walk
 * descends into the rank below it.
 *
 * @type {(nodes: readonly _Node[]) => readonly (readonly _Node[])[]}
 */
const byRank = nodes => {
    const maxRank = nodes.reduce((m, n) => Math.max(m, n.rank), 0)
    return Array.from({ length: maxRank + 1 }, (_, rank) => nodes.filter(n => n.rank === rank))
}

/** @type {(row: readonly _Node[]) => (y: number) => readonly _Positioned[]} */
const layoutRow = row => y => row.reduce((acc, node) => {
    const width = widthOf(node.label)
    return {
        x: acc.x + width + colGap,
        positioned: [...acc.positioned, { ...node, x: acc.x, y, width, height: nodeHeight }],
    }
}, { x: margin, positioned: /** @type {readonly _Positioned[]} */ ([]) }).positioned

/** @type {(nodes: readonly _Node[]) => readonly _Positioned[]} */
const layout = nodes => byRank(nodes).flatMap(
    (row, rank) => layoutRow(row)(margin + rank * (nodeHeight + rowGap)))

/**
 * `edges`, with same-pair edges combined into one line. Three array
 * elements sharing one value are three edges with the same `from`/`to` and
 * different labels — drawn separately they land on the same two points and
 * only the last label is ever visible, so they draw as one line labeled
 * with every index or key that reaches it.
 *
 * @type {(edges: readonly _Edge[]) => readonly _Edge[]}
 */
const mergeParallel = edges => edges.reduce((acc, edge) => {
    const at = acc.findIndex(e => e.from === edge.from && e.to === edge.to)
    return at === -1
        ? [...acc, edge]
        : acc.with(at, { ...acc[at], label: `${acc[at].label}, ${edge.label}` })
}, /** @type {readonly _Edge[]} */ ([]))

/**
 * A graph, drawn: a node per array, object and leaf, an edge per index or
 * key, ranked by depth of first discovery.
 *
 * @type {(g: { readonly nodes: readonly _Node[], readonly edges: readonly _Edge[] }) => Element}
 */
const graphSvg = g => {
    const positioned = layout(g.nodes)
    const at = /** @type {(id: number) => _Positioned} */ (id => positioned.find(p => p.id === id))
    const width = positioned.reduce((m, p) => Math.max(m, p.x + p.width), 0) + margin
    const height = margin + positioned.reduce((m, p) => Math.max(m, p.y + p.height), 0)
    /** @type {readonly Element[]} */
    const edgeEls = mergeParallel(g.edges).flatMap(edge => {
        const from = at(edge.from)
        const to = at(edge.to)
        const x1 = from.x + from.width / 2
        const y1 = from.y + from.height
        const x2 = to.x + to.width / 2
        const y2 = to.y
        // Every edge is this one curve, control point included — a straight
        // line is just the case where the control point sits on the
        // midpoint. A skip-level edge, a shared node reached again from
        // above an intervening rank, bows instead: reached straight, it
        // would fall on the same vertical as whichever one-rank edge first
        // reached that same node, and read as one line rather than two.
        const bow = to.rank - from.rank > 1 ? 24 : 0
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
        return [
            ['path', {
                d: `M${x1},${y1} Q${cx},${cy} ${x2},${y2}`,
                'data-graph-edge': '', 'marker-end': 'url(#graph-arrow)',
            }],
            ['text', {
                x: String(lx), y: String(ly),
                'text-anchor': 'middle', 'data-graph-edge-label': '',
            }, edge.label],
        ]
    })
    /** @type {readonly Element[]} */
    const nodeEls = positioned.flatMap(p => [
        ['rect', {
            x: String(p.x), y: String(p.y), width: String(p.width), height: String(p.height), rx: '4',
            'data-graph-node': '', 'data-graph-kind': p.kind,
        }],
        ['text', {
            x: String(p.x + p.width / 2), y: String(p.y + p.height / 2),
            'text-anchor': 'middle', 'data-graph-label': '',
        }, p.label],
    ])
    return ['svg', { viewBox: `0 0 ${width} ${height}`, width: String(width), height: String(height) },
        ['defs',
            ['marker', {
                id: 'graph-arrow', viewBox: '0 0 10 10', refX: '9', refY: '5',
                markerWidth: '6', markerHeight: '6', orient: 'auto',
            },
                ['path', { d: 'M0,0 L10,5 L0,10 z', 'data-graph-arrow': '' }]]],
        ...edgeEls,
        ...nodeEls,
    ]
}

/**
 * The state is the text itself, not the graph: the graph is a function of
 * it, and storing a value the state can already compute is how the two
 * drift apart.
 *
 * The initial document carries both of this demo's reasons for existing.
 * `"a"` and `"c"` name the same array — the one thing plain JSON cannot
 * show, drawn as one node with two incoming edges. And they reach it by
 * routes of different lengths, `"a"` directly and `"c"` through `"b"`, so
 * the array ranks by the longer one: `"a"`'s edge is the one that visibly
 * skips a rank, not the one that decided where the array sits.
 *
 * @type {Demo<string, DemoEvent>}
 */
export const demo = {
    init: 'const $0=[1,2];\nexport default {"a":$0,"b":{"c":$0}};',
    update: state => event => pureOk(event.kind === 'input' ? event.value : state),
    view: text => {
        const g = graphOf(text)
        return ['div',
            ['p',
                ['label', { for: 'datajs' }, 'DataJS '],
                ['textarea', { id: 'datajs', name: 'datajs', rows: '3' }, text],
            ],
            g.ok ? graphSvg(g) : ['p', `Error: ${g.error}`],
        ]
    },
}
