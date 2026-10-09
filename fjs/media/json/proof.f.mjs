/**
 * @import { DemoEvent } from '../../website/demo/types.ts'
 */

import { parse, serialize, setProperty, stringify } from './module.f.mjs'
import { demo, roundTrip } from './demo.f.mjs'
import { sort } from '../../types/object/module.f.mjs'
import { identity } from '../../types/function/module.f.mjs'
import { assert, assertEq, assertNotNullish, assertError, assertStructurallySame } from '../../asserts/module.f.mjs'
import { htmlToString } from '../html/module.f.mjs'
import { unwrap } from '../../types/result/module.f.mjs'
import { runPure } from '../../effects/module.f.mjs'
import { concat } from '../../types/string/module.f.mjs'

const { is } = Object

/** The value a JSON text parses to; throws if it is malformed. @type {(text: string) => unknown} */
const parsed = text => unwrap(parse(text))

export const proof = {
    setProperty: [
        () => {
            if (setProperty("Hello")([])({}) !== "Hello") { throw 'error' }
        },
        () => {
            // src === null: should treat as empty object
            const x = stringify(sort)(setProperty("Hello")(['a'])(null))
            if (x !== '{"a":"Hello"}') { throw x }
        },
        () => {
            // typeof src !== 'object': primitive src treated as empty object
            const x = stringify(sort)(setProperty("Hello")(['a'])(/** @type {null} */ (/** @type {unknown} */ (42))))
            if (x !== '{"a":"Hello"}') { throw x }
        },
        () => {
            // src instanceof Array: array src treated as empty object
            const x = stringify(sort)(setProperty("Hello")(['a'])(/** @type {null} */ (/** @type {unknown} */ ([1, 2]))))
            if (x !== '{"a":"Hello"}') { throw x }
        },
    ],
    stringify: [
        {
            sort: () => {
                const r = setProperty("Hello")(['a'])({})
                const x = stringify(sort)(r)
                if (x !== '{"a":"Hello"}') { throw x }
            },
            identity: () => {
                const x = stringify(identity)(setProperty("Hello")(['a'])({}))
                if (x !== '{"a":"Hello"}') { throw x }
            },
        },
        {
            sort: () => {
                const x = stringify(sort)(setProperty("Hello")(['a'])({ c: [], b: 12 }))
                if (x !== '{"a":"Hello","b":12,"c":[]}') { throw x }
            },
            identity: () => {
                const x = stringify(identity)(setProperty("Hello")(['a'])({ c: [], b: 12 }))
                if (x !== '{"c":[],"b":12,"a":"Hello"}') { throw x }
            },
        },
        {
            sort: () => {
                const _0 = { a: { y: [24] }, c: [], b: 12 }
                const _1 = setProperty("Hello")(['a', 'x'])(_0)
                const _2 = stringify(sort)(_1)
                if (_2 !== '{"a":{"x":"Hello","y":[24]},"b":12,"c":[]}') { throw _2 }
            },
            identity: () => {
                const _0 = { a: { y: [24] }, c: [], b: 12 }
                const _1 = setProperty("Hello")(['a', 'x'])(_0)
                const _2 = stringify(identity)(_1)
                if (_2 !== '{"a":{"y":[24],"x":"Hello"},"c":[],"b":12}') { throw _2 }
            }
        }
    ],
    undefined: () => {
        assertEq(stringify(sort)({ x: undefined }), '{}')
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
            assertEq(stringify(sort)(-0), '-0')
            assertEq(stringify(sort)(0), '0')
            assertEq(stringify(sort)([-0, 0, [-0]]), '[-0,0,[-0]]')
            assertEq(stringify(sort)({ b: 0, a: { c: -0 } }), '{"a":{"c":-0},"b":0}')
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
                assert(is(parsed(stringify(sort)(value)), value))
            }
            const nested = { a: [-0, 0, { b: -0 }], c: 0 }
            assertStructurallySame(parsed(stringify(sort)(nested)), nested)
        },
    },
    parse: {
        ok: () => {
            const [t, v] = parse('{"a":[1,true,null],"b":"x"}')
            assertEq(t, 'ok')
            assertEq(stringify(sort)(v), '{"a":[1,true,null],"b":"x"}')
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
            assert(empty.includes(unwrap(roundTrip(demo.init)).replaceAll('"', '&quot;')), empty)
            const typed = htmlToString(demo.view('[1,2]'))
            assert(typed.includes('[1,2]'), typed)
            assert(typed.includes(unwrap(roundTrip('[1,2]'))), typed)
            const refused = htmlToString(demo.view('{'))
            assert(refused.includes('Refused:</p><pre data-result="error">unexpected end</pre>'), refused)
            assert(!refused.includes('Parsed, then written back:'), refused)
        },
    },
}
