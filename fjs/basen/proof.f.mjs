/**
 * @import { DemoEvent } from '../website/demo/types.ts'
 */

import { assert, assertEq, assertNotNullish } from '../asserts/module.f.mjs'
import { empty, maxLength, vec, length } from '../types/bit_vec/module.f.mjs'
import { baseN } from './module.f.mjs'
import { demo, encodings } from './demo.f.mjs'
import { htmlToString } from '../media/html/module.f.mjs'
import { unwrap } from '../types/result/module.f.mjs'
import { runPure } from '../effects/module.f.mjs'

const hex = baseN(4n, '0123456789abcdef')

// A synthetic normalizer keeps this proof focused on `baseN`'s mechanism
// rather than duplicating the rules owned by a concrete codec.
const normalizedHex = baseN(4n, '0123456789abcdef', c =>
    c === 'x' ? 'a' : c === 'y' ? 'z' : c.toLowerCase())

// Sample input for the `big` proof below: 262 144 `f` characters decode into a
// 1 Mibit (`maxLength`) vector.
const bigSampleHex = `f`.repeat(Number(maxLength >> 2n))

export const proof = {
    encodeEmpty: () => {
        const s = hex.vecToString(empty)
        assertEq(s, '', [s])
    },
    encodeAligned: () => {
        // Two 4-bit chunks → two hex digits
        const s = hex.vecToString(vec(8n)(0xa5n))
        assertEq(s, 'a5', [s])
    },
    encodeUnaligned: () => {
        // 6 bits → first 4-bit chunk + a 2-bit tail that popFront pads with
        // trailing zeros (the standard `popFront` behaviour the codec inherits).
        const s = hex.vecToString(vec(6n)(0b101001n))
        assertEq(s, 'a4', [s])
    },
    decodeEmpty: () => {
        const v = hex.stringToVec('')
        assertEq(v, empty, [v])
    },
    decodeRoundTrip: () => {
        const v = hex.stringToVec('ab')
        assertEq(v, vec(8n)(0xabn), [v])
    },
    decodeInvalid: () => {
        assertEq(hex.stringToVec('z'), null, 'invalid char should return null')
        assertEq(hex.stringToVec('aZ'), null, 'mixed invalid char should return null')
    },
    normalizeHit: () => {
        // 'A' lowercases to 'a' — same vector as the lowercase input.
        const a = normalizedHex.stringToVec('A')
        const b = normalizedHex.stringToVec('a')
        assertEq(a, b, [a, b])
        assertEq(normalizedHex.stringToVec('x'), a, 'x→a')
    },
    normalizeMiss: () => {
        assertEq(normalizedHex.stringToVec('y'), null, 'normalizing to an unknown char should return null')
    },
    // Decodes a 1 Mibit hex string. With the O(n log n) `listToVec` builder this
    // runs in well under a second (was ~13 s node / ~43 s bun under the old
    // per-chunk `concat`).
    big: () => {
        const x = hex.stringToVec(bigSampleHex)
        assertEq(length(assertNotNullish(x)), maxLength)
    },
    demo: {
        /**
         * **What the demo shows is pinned**: the groups it draws and the
         * codecs' own output for them. The Base64 results are what
         * `printf '%s' … | base64` prints.
         */
        encodings: () => {
            assertEq(JSON.stringify(encodings('')), JSON.stringify({
                bytes: [],
                base64: { groups: [], encoded: '' },
                cBase32: { groups: ['·10000'], encoded: 'g' },
            }))
            assertEq(JSON.stringify(encodings('h')), JSON.stringify({
                bytes: ['01101000'],
                base64: { groups: ['011010', '00·0000'], encoded: 'aA==' },
                cBase32: { groups: ['01101', '000·10'], encoded: 'd2' },
            }))
            assertEq(JSON.stringify(encodings('hé')), JSON.stringify({
                bytes: ['01101000', '11000011', '10101001'],
                base64: { groups: ['011010', '001100', '001110', '101001'], encoded: 'aMOp' },
                cBase32: { groups: ['01101', '00011', '00001', '11010', '1001·1'], encoded: 'd31tk' },
            }))
        },
        // An unpaired surrogate has no UTF-8 bytes, so there is nothing to
        // encode; it is refused rather than shown as bytes.
        unpairedSurrogate: () => {
            assertEq(encodings('a\uD800'), 'error: unpaired surrogate, no UTF-8')
        },
        // Typing replaces the text; every other event leaves it alone.
        update: () => {
            /** @type {(event: DemoEvent) => (state: string) => string} */
            const step = event => state => unwrap(assertNotNullish(
                runPure(demo.update(state)(event))[0],
                'expected the demo to reach a value without asking for an operation'))
            assertEq(step({ kind: 'input', name: 'text', value: 'a' })(''), 'a')
            assertEq(step({ kind: 'start' })('kept'), 'kept')
        },
        /**
         * **A character sits under its group**: the two are one table column,
         * the group in a data cell and the character in a header cell, four
         * groups to a row — `hé` makes CBase32 five groups, so two rows.
         */
        view: () => {
            const html = htmlToString(demo.view(demo.init))
            assert(html.includes('name="text"'), html)
            assert(html.includes('<tr><td>011010</td><td>001100</td><td>001110</td><td>101001</td></tr><tr><th>a</th><th>M</th><th>O</th><th>p</th></tr>'), html)
            assert(html.includes('<tr><td>1001·1</td></tr><tr><th>k</th></tr>'), html)
            assert(html.includes('Result: <strong>aMOp</strong>'), html)
            assert(html.includes('Result: <strong>d31tk</strong>'), html)
            // Empty text has no bytes and no Base64 groups, so no Base64
            // table; CBase32 still has its stop bit.
            const empty = htmlToString(demo.view(''))
            assert(empty.includes('<pre>(empty)</pre>'), empty)
            assert(empty.includes('Result: <strong>(empty)</strong>'), empty)
            assertEq(empty.split('<table>').length, 2)
            const refused = htmlToString(demo.view('a\uD800'))
            assert(refused.includes('<strong>error: unpaired surrogate, no UTF-8</strong>'), refused)
        },
    },
}
