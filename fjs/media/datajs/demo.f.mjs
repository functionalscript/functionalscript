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
 * **Laid out and drawn by `fjs/website/demo/graph`**, the shared half of any
 * demo whose value is a graph rather than a scalar: this module's own job is
 * only turning a parsed document into that module's `Node`/`Edge` shapes,
 * reference identity included, and everything about rank and geometry is
 * that module's — see its own doc for why a node's rank is the longest path
 * from the root rather than the first one a walk happens to take.
 *
 * **It needs no operations.** Parsing and walking are pure functions of the
 * text, so `update` declares `never` and returns through `pureOk`.
 *
 * @module
 *
 * @import { Primitive, Unknown } from './types.ts'
 * @import { Demo, DemoEvent } from '../../website/demo/types.ts'
 * @import { Edge, Node, Ranked } from '../../website/demo/graph/types.ts'
 * @import { _State } from './private.ts'
 */

import { tryParse } from './module.f.mjs'
import { keySerialize, leafSerialize } from './serializer/module.f.mjs'
import { concat } from '../../types/string/module.f.mjs'
import { pureOk } from '../../effects/module.f.mjs'
import { ranked, graphSvg } from '../../website/demo/graph/module.f.mjs'

const { is } = Object

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
        /** @type {Node} */
        const node = { id, kind: 'leaf', label: concat(leafSerialize(/** @type {Primitive} */ (value))) }
        return { id, state: { ...state, next: id + 1, nodes: [...state.nodes, node] } }
    }
    const existing = findRef(state)(value)
    if (existing !== null) { return { id: existing, state } }
    const id = state.next
    const isArray = value instanceof Array
    /** @type {Node} */
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
 * `text` as the graph it denotes, or the parser's own error if it does not
 * denote one.
 *
 * @type {(text: string) => { readonly ok: true, readonly nodes: readonly Ranked[], readonly edges: readonly Edge[] } | { readonly ok: false, readonly error: string }}
 */
export const _graphOf = text => {
    const result = tryParse(text)
    if (result[0] === 'error') { return { ok: false, error: result[1] } }
    const { state } = walk({ refs: [], nodes: [], edges: [], next: 0 })(result[1])
    return { ok: true, nodes: ranked(state.nodes, state.edges), edges: state.edges }
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
        const g = _graphOf(text)
        return ['div',
            ['p',
                ['label', { for: 'datajs' }, 'DataJS '],
                ['textarea', { id: 'datajs', name: 'datajs', rows: '8' }, text],
            ],
            g.ok ? graphSvg(g) : ['p', `Error: ${g.error}`],
        ]
    },
}
