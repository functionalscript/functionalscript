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
 * **A container gets one node per distinct reference; a leaf gets no node
 * at all** — "primitive sharing is not [written]", in the specification's
 * own words, so a leaf is drawn inline, in the port of the container that
 * holds it. Only a document that is a leaf and nothing else draws one as a
 * node, having no container to sit in. Reference identity, checked with `Object.is`,
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
 * @import { Examples } from '../../website/demo/examples/types.ts'
 * @import { _State } from './private.ts'
 */

import { tryParse } from './module.f.mjs'
import { keySerialize, leafSerialize } from './serializer/module.f.mjs'
import { concat } from '../../types/string/module.f.mjs'
import { ranked, graphSvg } from '../../website/demo/graph/module.f.mjs'
import { textDemo } from '../../website/demo/module.f.mjs'

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

/** @type {(value: Unknown) => value is Primitive} */
const isPrimitive = value => value === null || typeof value !== 'object'

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
    if (isPrimitive(value)) {
        const id = state.next
        /** @type {Node} */
        const node = { id, kind: 'leaf', label: concat(leafSerialize(value)) }
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
            if (isPrimitive(item)) {
                return { ...acc, edges: [...acc.edges, { from: id, to: { inline: concat(leafSerialize(item)) }, label }] }
            }
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
 * The documents the examples drop-down offers, each under the name it is
 * picked by: one per thing the drawing has to say, so a reader can see each
 * without first working out how to write it.
 *
 * **The first is the overview**, and the demo opens on it. It carries both of
 * this demo's reasons for existing. `"a"` and `"c"` name the same array — the
 * one thing plain JSON cannot show, drawn as one node with two incoming
 * edges. And they reach it by routes of different lengths, `"a"` directly and
 * `"c"` through `"b"`, so the array ranks by the longer one: `"a"`'s edge is
 * the one that visibly skips a rank, not the one that decided where the array
 * sits.
 *
 * The other ten take one point each, on its own:
 *
 * - **JSON** is a JSON value made a document the way the specification
 *   converts one — `export default` before it, `;` after — and draws as the
 *   tree it is: nothing in JSON can be reached twice.
 * - **Primitives** puts every kind of leaf — `null`, a boolean, a string, a
 *   number, `-0`, `NaN`, an infinity, a bigint, `undefined` — inline in the
 *   port that holds it.
 * - **Equal is not shared** writes the same array twice, and draws two
 *   nodes: only a `const` makes sharing.
 * - **One node, many references** is one object reached from three indices,
 *   each its own port and line.
 * - **Diamond** builds two `const`s on a third, which both reach.
 * - **Longest path wins** reaches a shared array one rank away and three,
 *   and the array ranks at three.
 * - **A shared primitive is not a node** names `1` once and uses it twice:
 *   a primitive has no identity, so it draws as two cells.
 * - **Unused const** declares a value the export never reaches, which is
 *   not part of what the document means; the document is a leaf, drawn as a
 *   node since there is no container to hold it.
 * - **Object keys** repeats a key, which keeps its first position and its
 *   last value, writes index keys out of order, which read back in numeric
 *   order before every other key, and uses the one spelling `__proto__`
 *   has.
 * - **Error: JSON is not a document** is JSON without the conversion, which
 *   the parser refuses: at the top of a module, `{` opens a block.
 *
 * @type {Examples}
 */
export const examples = [
    ['Overview', 'const $0=[1,2];\nexport default {"a":$0,"b":{"c":$0}};'],
    ['JSON', 'export default {"name":"fjs","tags":["data","graph"],"version":1};'],
    ['Primitives', 'export default [null,true,"s",-42.5,-0,NaN,-Infinity,1n,undefined];'],
    ['Equal is not shared', 'export default [[1,2],[1,2]];'],
    ['One node, many references', 'const $0={"n":1};\nexport default [$0,$0,$0];'],
    ['Diamond', 'const $leaf=[1];\nconst $l={"x":$leaf};\nconst $r={"y":$leaf};\nexport default [$l,$r];'],
    ['Longest path wins', 'const $0=[1];\nexport default {"a":$0,"b":{"c":{"d":$0}}};'],
    ['A shared primitive is not a node', 'const $x=1;\nexport default [$x,$x];'],
    ['Unused const', 'const $dead=undefined;\nexport default 1;'],
    ['Object keys', 'export default {"b":1,"2":2,"1":3,"b":4,["__proto__"]:5};'],
    ['Error: JSON is not a document', '{"a":1}'],
]

/**
 * The state is the text itself, not the graph: the graph is a function of
 * it, and storing a value the state can already compute is how the two
 * drift apart. Picking an example replaces the text with its source.
 *
 * The picker is built once, as the module loads, which is where a list
 * with a repeated name or source is refused.
 *
 * @type {Demo<string, DemoEvent>}
 */
export const demo = textDemo({ name: 'datajs', label: 'DataJS', init: examples[0][1], examples })(text => {
    const g = _graphOf(text)
    return [g.ok ? graphSvg(g) : ['p', `Error: ${g.error}`]]
})
