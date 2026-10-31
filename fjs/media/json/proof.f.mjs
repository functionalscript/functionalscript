/**
 * @import { DemoEvent } from '../../website/demo/types.ts'
 */

import { marked, parse, serialize, setProperty, stringify, stringifySorted } from './module.f.mjs'
import { _roundTripMarked, demo, roundTrip } from './demo.f.mjs'
import { sort } from '../../types/object/module.f.mjs'
import { identity } from '../../types/function/module.f.js'
import { assert, assertEq, assertNotNullish, assertError, assertStructurallySame } from '../../asserts/module.f.js'
import { htmlToString } from '../html/module.f.mjs'
import { toText } from '../../text/marked/module.f.mjs'
import { disagreement } from '../../js/marked/module.f.mjs'
import { unwrap } from '../../types/result/module.f.js'
import { runPure } from '../../effects/module.f.mjs'
import { concat } from '../../types/string/module.f.js'

const { is } = Object

/** The value a JSON text parses to; throws if it is malformed. @type {(text: string) => unknown} */
const parsed = text => unwrap(parse(text))

export const proof = {
    setProperty: [
        () => {
            assertEq(setProperty("Hello")([])({}), "Hello")
        },
        () => {
            // src === null: should treat as empty object
            const x = stringifySorted(setProperty("Hello")(['a'])(null))
            assertEq(x, '{"a":"Hello"}')
        },
        () => {
            // typeof src !== 'object': primitive src treated as empty object
            const x = stringifySorted(setProperty("Hello")(['a'])(/** @type {null} */ (/** @type {unknown} */ (42))))
            assertEq(x, '{"a":"Hello"}')
        },
        () => {
            // src instanceof Array: array src treated as empty object
            const x = stringifySorted(setProperty("Hello")(['a'])(/** @type {null} */ (/** @type {unknown} */ ([1, 2]))))
            assertEq(x, '{"a":"Hello"}')
        },
    ],
    // `marked` is `stringify` as runs: the same text, with the leaves' kinds
    marked: () => {
        const value = { b: null, a: 'x', c: [1, true] }
        assertEq(toText(marked(sort)(value)), stringifySorted(value))
        assertEq(
            JSON.stringify(marked(sort)(value).filter(([, kind]) => kind !== undefined)),
            '[["\\"a\\"","string"],["\\"x\\"","string"],["\\"b\\"","string"],["null","literal"],["\\"c\\"","string"],["1","number"],["true","literal"]]')
    },
    stringify: [
        {
            sort: () => {
                const r = setProperty("Hello")(['a'])({})
                const x = stringify(sort)(r)
                assertEq(x, '{"a":"Hello"}')
            },
            identity: () => {
                const x = stringify(identity)(setProperty("Hello")(['a'])({}))
                assertEq(x, '{"a":"Hello"}')
            },
        },
        {
            sort: () => {
                const x = stringify(sort)(setProperty("Hello")(['a'])({ c: [], b: 12 }))
                assertEq(x, '{"a":"Hello","b":12,"c":[]}')
            },
            identity: () => {
                const x = stringify(identity)(setProperty("Hello")(['a'])({ c: [], b: 12 }))
                assertEq(x, '{"c":[],"b":12,"a":"Hello"}')
            },
        },
        {
            sort: () => {
                const _0 = { a: { y: [24] }, c: [], b: 12 }
                const _1 = setProperty("Hello")(['a', 'x'])(_0)
                const _2 = stringify(sort)(_1)
                assertEq(_2, '{"a":{"x":"Hello","y":[24]},"b":12,"c":[]}')
            },
            identity: () => {
                const _0 = { a: { y: [24] }, c: [], b: 12 }
                const _1 = setProperty("Hello")(['a', 'x'])(_0)
                const _2 = stringify(identity)(_1)
                assertEq(_2, '{"a":{"y":[24],"x":"Hello"},"c":[],"b":12}')
            }
        }
    ],
    // `stringifySorted` is `stringify(sort)`: the canonical form, so values
    // that differ only in key order, at any depth, write the same text.
    stringifySorted: () => {
        const text = '{"a":{"x":1,"y":[{"p":true,"q":null}]},"b":"z"}'
        assertEq(stringifySorted({ b: 'z', a: { y: [{ q: null, p: true }], x: 1 } }), text)
        assertEq(stringifySorted({ a: { x: 1, y: [{ p: true, q: null }] }, b: 'z' }), text)
    },
    undefined: () => {
        assertEq(stringifySorted({ x: undefined }), '{}')
    },
    /**
     * **`-0` survives a round trip.** It is valid JSON, and this codec writes
     * it as `-0` where `JSON.stringify` writes `0` — a deliberate difference
     * from the native API. Leaves are compared with `Object.is` (directly, or
     * through `assertStructurallySame`), since `===` cannot tell the zeros
     * apart.
     */
    negativeZero: {
        serialize: () => {
            assertEq(concat(serialize(sort)(-0)), '-0')
            assertEq(concat(serialize(sort)([-0, 0])), '[-0,0]')
        },
        stringify: () => {
            assertEq(stringifySorted(-0), '-0')
            assertEq(stringifySorted(0), '0')
            assertEq(stringifySorted([-0, 0, [-0]]), '[-0,0,[-0]]')
            assertEq(stringifySorted({ b: 0, a: { c: -0 } }), '{"a":{"c":-0},"b":0}')
        },
        // every spelling of a negative zero the grammar admits, a negative
        // underflow, and their unsigned counterparts
        parse: () => {
            for (const text of ['-0', '-0.0', '-0e0', '-0E+0', '-1e-400']) {
                assert(is(parsed(text), -0), text)
            }
            for (const text of ['0', '0.0', '0e0', '0E+0', '1e-400']) {
                assert(is(parsed(text), 0), text)
            }
            assertStructurallySame(parsed('[-0,{"a":[-0.0,0]}]'), [-0, { a: [-0, 0] }])
            assertEq(parse('-')[0], 'error')
            assertEq(parse('-00')[0], 'error')
        },
        roundTrip: () => {
            for (const value of [-0, 0]) {
                assert(is(parsed(stringifySorted(value)), value))
            }
            const nested = { a: [-0, 0, { b: -0 }], c: 0 }
            assertStructurallySame(parsed(stringifySorted(nested)), nested)
        },
    },
    parse: {
        ok: () => {
            const [t, v] = parse('{"a":[1,true,null],"b":"x"}')
            assertEq(t, 'ok')
            assertEq(stringifySorted(v), '{"a":[1,true,null],"b":"x"}')
        },
        // Malformed input is an error value, not a throw.
        error: () => {
            const [t] = parse('{')
            assertEq(t, 'error')
        },
    },
    demo: {
        /**
         * **The round trip the demo shows is this module's own.** Pinned
         * here so a change to `parse`, to `stringify`, or to the way the
         * demo combines them lands on a test rather than only on a page
         * nobody is looking at.
         */
        roundTrip: () => {
            assertEq(unwrap(roundTrip('{"b":2,"a":1}')), '{"a":1,"b":2}')
            assertEq(
                unwrap(roundTrip('{\n  "b": 2,\n  "a": [3, 2, 1],\n  "c": "hello"\n}')),
                '{"a":[3,2,1],"b":2,"c":"hello"}')
            // What it marks, the tokenizer agrees with, for every kind a
            // document holds: strings, numbers, `null` and the booleans.
            assertEq(disagreement(unwrap(_roundTripMarked('{"s":"x","n":-1.5,"z":0,"t":true,"f":false,"u":null,"a":[]}'))), null)
            // A parse failure is shown, not swallowed.
            assertEq(assertError(roundTrip('{')), 'unexpected end')
        },
        // Typing replaces the text; every other event leaves it alone, which
        // is what `start` is for — a first render with nothing typed yet.
        update: () => {
            /**
             * **`runPure` and not a call.** An effect is a `Pure` thunk or a
             * `Do` node, and only the first is callable; `[r]` says this
             * demo reached a value without asking for an operation, which is
             * what `O = never` claims.
             *
             * @type {(event: DemoEvent) => (state: string) => string}
             */
            const step = event => state => unwrap(assertNotNullish(
                runPure(demo.update(state)(event))[0],
                'expected the demo to reach a value without asking for an operation'))
            assertEq(step({ kind: 'input', name: 'json', value: '[1]' })(''), '[1]')
            assertEq(step({ kind: 'start' })('kept'), 'kept')
        },
        /**
         * **The field carries a `name`, and that is the contract.** It is
         * what comes back as the event's `name`, so a demo tells its fields
         * apart without ever holding a DOM node.
         *
         * The initial output is checked against its own escaped quotes: a
         * `pre`'s text is HTML-escaped like any other, so the literal
         * successful `roundTrip` value with `"` in it never appears in the markup —
         * only what a browser decodes back into it does.
         */
        view: () => {
            const empty = htmlToString(demo.view(demo.init))
            assert(empty.includes('name="json"'), empty)
            // the output is coloured, so its text is spread over spans: the
            // copy payload keeps it whole
            assert(empty.includes(`data-copy="${unwrap(roundTrip(demo.init)).replaceAll('"', '&quot;')}"`), empty)
            assert(empty.includes('<span data-token="string">&quot;a&quot;</span>'), empty)
            const typed = htmlToString(demo.view('[1,2]'))
            assert(typed.includes('[1,2]'), typed)
            assert(typed.includes('data-copy="[1,2]"'), typed)
            assert(typed.includes('aria-label="Copy JSON"'), typed)
            assert(typed.includes('<span data-token="number">1</span>,<span data-token="number">2</span>'), typed)
            const refused = htmlToString(demo.view('{'))
            assert(refused.includes('Refused:</p><pre data-result="error">unexpected end</pre>'), refused)
            assert(!refused.includes('Parsed, then written back:'), refused)
        },
    },
}
