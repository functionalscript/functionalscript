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
 * **Walked, laid out and drawn by `fjs/website/demo/graph`**, the shared
 * half of any demo whose value is a graph rather than a scalar: this
 * module's own job is only saying what shape each parsed value has, and
 * the walk, reference identity included, and everything about rank and
 * geometry are that module's — see its own doc for why a node's rank is the
 * longest path from the root rather than the first one a walk happens to
 * take.
 *
 * **It needs no operations.** Parsing and walking are pure functions of the
 * text, so `update` declares `never` and returns through `pureOk`.
 *
 * @module
 *
 * @import { Primitive, Unknown } from './types.ts'
 * @import { Demo, DemoEvent } from '../../website/demo/types.ts'
 * @import { Graph, Shape } from '../../website/demo/graph/types.ts'
 * @import { Examples } from '../../website/demo/examples/types.ts'
 */

import { tryParse } from './module.f.mjs'
import { keySerialize, leafSerialize } from './serializer/module.f.mjs'
import { concat } from '../../types/string/module.f.mjs'
import { graphOf, graphSvg } from '../../website/demo/graph/module.f.mjs'
import { textDemo, refusal } from '../../website/demo/module.f.mjs'

/** @type {(value: Unknown) => value is Primitive} */
const isPrimitive = value => value === null || typeof value !== 'object'

/**
 * How the walk reads one value: a leaf is its serialization, inline; an
 * array or an object is a node whose children are its items or entries.
 *
 * @type {(value: Unknown) => Shape<Unknown>}
 */
const shapeOf = value => isPrimitive(value) ? { inline: concat(leafSerialize(value)) }
    : value instanceof Array
        ? { kind: 'array', label: '[ ]', children: value.map((item, index) => [String(index), item]) }
        : { kind: 'object', label: '{ }', children: Object.entries(value).map(([key, item]) => [concat(keySerialize(key)), item]) }

/**
 * `text` as the graph it denotes, or the parser's own error if it does not
 * denote one.
 *
 * @type {(text: string) => ({ readonly ok: true } & Graph) | { readonly ok: false, readonly error: string }}
 */
export const _graphOf = text => {
    const result = tryParse(text)
    return result[0] === 'error' ? { ok: false, error: result[1] } : { ok: true, ...graphOf(shapeOf)(result[1]) }
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
 * The other eleven take one point each, on its own:
 *
 * - **JSON** is a JSON value made a document the way the specification
 *   converts one — `export default` before it, `;` after — and draws as the
 *   tree it is: nothing in JSON can be reached twice.
 * - **Nested tree** is a tree three containers deep, drawn with each
 *   container centred beside the containers it holds.
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
 * - **Plain JSON** is JSON without the conversion, which
 *   the parser refuses: at the top of a module, `{` opens a block.
 *
 * @type {Examples}
 */
export const examples = [
    ['Overview', 'const $0=[1,2];\nexport default {"a":$0,"b":{"c":$0}};'],
    ['JSON', 'export default {"name":"fjs","tags":["data","graph"],"version":1};'],
    ['Nested tree', 'export default {"a":[[1],[2,3]],"b":{"c":[4],"d":{"e":[5,6],"f":[7]}},"g":[8]};'],
    ['Primitives', 'export default [null,true,"s",-42.5,-0,NaN,-Infinity,1n,undefined];'],
    ['Equal is not shared', 'export default [[1,2],[1,2]];'],
    ['One node, many references', 'const $0={"n":1};\nexport default [$0,$0,$0];'],
    ['Diamond', 'const $leaf=[1];\nconst $l={"x":$leaf};\nconst $r={"y":$leaf};\nexport default [$l,$r];'],
    ['Longest path wins', 'const $0=[1];\nexport default {"a":$0,"b":{"c":{"d":$0}}};'],
    ['A shared primitive is not a node', 'const $x=1;\nexport default [$x,$x];'],
    ['Unused const', 'const $dead=undefined;\nexport default 1;'],
    ['Object keys', 'export default {"b":1,"2":2,"1":3,"b":4,["__proto__"]:5};'],
    ['Plain JSON', '{"a":1}'],
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
export const demo = textDemo({
    intro: 'Parses a DataJS document and draws its graph. Containers are nodes, leaves appear inside them, and multiple arrows to one node show a shared reference.',
    name: 'datajs',
    label: 'DataJS',
    init: examples[0][1],
    examples,
})(text => {
    const g = _graphOf(text)
    return [g.ok ? graphSvg(g) : refusal(g.error)]
})
