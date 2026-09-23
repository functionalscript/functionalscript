/**
 * @import { Assert } from '../../asserts/types.ts'
 * @import { List } from '../../types/list/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { Equal } from '../../types/ts/types.ts'
 * @import { U8 } from '../../text/utf8/types.ts'
 * @import { DemoEvent } from '../../website/demo/types.ts'
 * @import { Unknown } from './types.ts'
 */

import { assert, assertEq, assertNotNullish } from '../../asserts/module.f.mjs'
import { fromCodePointList } from '../../text/utf8/module.f.mjs'
import { stringToCodePointList } from '../../text/utf16/module.f.mjs'
import { unwrap } from '../../types/result/module.f.mjs'
import { concat } from '../../types/string/module.f.mjs'
import { tryParse, tryParseBytes, trySerialize, tryStringify } from './module.f.mjs'
import { demo } from './demo.f.mjs'
import { difference } from './vectors/module.f.mjs'
import { htmlToString } from '../html/module.f.mjs'
import { runPure } from '../../effects/module.f.mjs'

/** A document in normalized form: sharing, and the leaves JSON cannot carry. */
const document = 'const $0=[1n,undefined,NaN,-0];export default {"a":$0,"b":$0,"c":"é€𐀀"};'

/** The document's UTF-8 bytes. @type {(text: string) => List<U8>} */
const utf8 = text => fromCodePointList(stringToCodePointList(text))

/** The graph the document denotes, read as code units. */
const graph = unwrap(tryParse(document))

/** How many times `needle` appears in `text`, non-overlapping. @type {(text: string, needle: string) => number} */
const occurrences = (text, needle) => text.split(needle).length - 1

export const proof = {
    // The surface holds the four signatures the design fixed, and the
    // deeper proofs are each entry point's own: `parser/proof.f.mjs` for the
    // two readers, `serializer/proof.f.mjs` for the two writers, and the
    // conformance corpus for all four. What is proved here is that the four
    // compose as one codec.
    signatures: () => {
        /** @typedef {Assert<Equal<typeof tryParse, (text: string) => Result<Unknown, string>>>} _TryParse */
        /** @typedef {Assert<Equal<typeof tryParseBytes, (bytes: List<U8>) => Result<Unknown, string>>>} _TryParseBytes */
        /** @typedef {Assert<Equal<typeof trySerialize, (value: Unknown) => Result<List<string>, string>>>} _TrySerialize */
        /** @typedef {Assert<Equal<typeof tryStringify, (value: Unknown) => Result<string, string>>>} _TryStringify */
    },
    // Writing what was read gives the document back: normalized form is one
    // spelling per value, and the reader keeps the sharing the writer hoists.
    roundTrip: () => assertEq(unwrap(tryStringify(graph)), document),
    // The byte path reads the same graph from the document's UTF-8 bytes,
    // the four-byte scalar in `"c"` crossing the bridge back to a pair.
    bytes: () => assertEq(difference(graph)(unwrap(tryParseBytes(utf8(document)))), null),
    // The chunked writer and the string writer are one writer.
    chunks: () => assertEq(concat(unwrap(trySerialize(graph))), document),
    // Each side refuses rather than approximating.
    refused: {
        text: () => assertEq(tryParse('export default [1,]')[0], 'error'),
        bytes: () => assertEq(tryParseBytes([0xef, 0xbb, 0xbf])[0], 'error'),
        // a value outside the model reaches the writer as a host would hand
        // it, cast; a FunctionalScript caller cannot hand one at all
        value: () => assertEq(tryStringify(/** @type {Unknown} */ (/** @type {unknown} */ (() => 1)))[0], 'error'),
    },
    demo: {
        graph: {
            // Two keys naming the same array from two different parents is
            // one node with two incoming edges, each its own label — the
            // graph's whole reason for being here, and the demo's own
            // initial document. `"a"` reaches it directly and `"c"` through
            // `"b"`, the longer route, so the array ranks by `"c"`'s path
            // and `"a"`'s edge is the one left skipping a rank.
            sharing: () => {
                const html = htmlToString(demo.view(demo.init))
                assertEq(occurrences(html, 'data-graph-kind="array"'), 1)
                assert(html.includes('>&quot;a&quot;<'), html)
                assert(html.includes('>&quot;c&quot;<'), html)
                assertEq(occurrences(html, 'data-graph-kind="leaf"'), 2)
            },
            // `typeof null === 'object'` is why `walk` checks `=== null`
            // first — without it, `null` would reach `instanceof Array` and
            // `Object.entries` as if it held members.
            nullIsALeaf: () => {
                const html = htmlToString(demo.view('export default null;'))
                assertEq(occurrences(html, 'data-graph-kind="leaf"'), 1)
                assert(!html.includes('data-graph-edge'), html)
                assert(html.includes('>null<'), html)
            },
            // An object's own leaf spelling — quoted keys, and the leaves
            // JSON cannot carry — is `leafSerialize`/`keySerialize`'s, read
            // through rather than reimplemented.
            leaves: () => {
                const html = htmlToString(demo.view('export default {"x":1n,"y":undefined,"z":-0};'))
                assert(html.includes('>&quot;x&quot;<'), html)
                assert(html.includes('>1n<'), html)
                assert(html.includes('>undefined<'), html)
                assert(html.includes('>-0<'), html)
            },
            // An index sits in a port of the array's own box, not on the
            // line: the header is 26px and the port under it 20px, so the
            // label is centred at y=46 and the edge leaves the port's
            // bottom at y=56.
            edgeLabelPosition: () => {
                const html = htmlToString(demo.view('export default [1];'))
                assert(html.includes('<text x="35" y="46" text-anchor="middle" data-graph-edge-label="">0<'), html)
                assert(html.includes('d="M35,56 Q35,76 35,96"'), html)
            },
            // Two equal numbers are two leaf nodes, not one shared like a
            // container would be — "primitive sharing is not [written]".
            equalLeavesDoNotShare: () => {
                const html = htmlToString(demo.view('export default [1,1];'))
                assertEq(occurrences(html, 'data-graph-kind="leaf"'), 2)
            },
            // Three array elements sharing one value are three ports and
            // three lines into one node — each index in its own cell, so
            // none is hidden under another and nothing has to be merged.
            parallelEdgesArePorts: () => {
                const html = htmlToString(demo.view('const $0={"n":1};\nexport default [$0,$0,$0];'))
                assertEq(occurrences(html, 'data-graph-kind="object"'), 1)
                assertEq(occurrences(html, 'data-graph-port=""'), 4)
                assertEq(occurrences(html, 'data-graph-edge=""'), 4)
                assert(!html.includes('>0, 1, 2<'), html)
            },
            // A shared node reached again from above an intervening rank
            // bows; the edges either side of it, one rank apart, do not —
            // the exact control points, since the layout is pure arithmetic
            // over document order and this document's order is fixed.
            skipLevelBow: () => {
                const html = htmlToString(
                    demo.view('const $0=[9];\nconst $1={"y":$0};\nexport default {"p":$1,"r":$0};'))
                assert(html.includes('d="M59.5,56 Q71.25,119 35,182"'), html)
                assert(html.includes('d="M26.5,56 Q30.75,76 35,96"'), html)
            },
            // The one case the first version of this demo got wrong: `$0` is
            // reached at rank 1 via `"a"`, then again at rank 3 via
            // `"b"."c"."d"` — the longer route. Rank by longest path moves
            // it to rank 3, so `"a"` becomes the one that skips ranks and
            // bows, and no edge is left pointing back up the page the way
            // `"a"` would if `$0` had kept its first-seen rank of 1.
            longestPathWins: () => {
                const html = htmlToString(demo.view(
                    'const $0=[1];\nexport default {"a":$0,"b":{"c":{"d":$0}}};'))
                assert(html.includes('d="M26.5,56 Q54.75,162 35,268"'), html)
                assert(html.includes('d="M59.5,56 Q47.25,76 35,96"'), html)
                assert(html.includes('d="M35,142 Q35,162 35,182"'), html)
                assert(html.includes('d="M35,228 Q35,248 35,268"'), html)
                assert(html.includes('d="M35,314 Q35,334 35,354"'), html)
            },
            // A parse failure is shown, not swallowed, and draws no graph.
            error: () => {
                const html = htmlToString(demo.view('{bad'))
                assert(html.includes('Error: unexpected symbol at 0'), html)
                assert(!html.includes('<svg'), html)
            },
        },
        // Typing replaces the text; every other event leaves it alone, which
        // is what `start` is for — a first render with nothing typed yet.
        update: () => {
            /** @type {(event: DemoEvent) => (state: string) => string} */
            const step = event => state => unwrap(assertNotNullish(
                runPure(demo.update(state)(event))[0],
                'expected the demo to reach a value without asking for an operation'))
            assertEq(step({ kind: 'input', name: 'datajs', value: '[1]' })(''), '[1]')
            assertEq(step({ kind: 'start' })('kept'), 'kept')
        },
        // The field carries a `name`, so a demo tells its fields apart
        // without ever holding a DOM node.
        view: () => {
            const html = htmlToString(demo.view(demo.init))
            assert(html.includes('name="datajs"'), html)
        },
    },
}
