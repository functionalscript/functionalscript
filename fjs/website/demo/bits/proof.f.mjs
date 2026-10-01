/**
 * @import { DemoEvent } from '../types.ts'
 * @import { BitScheme } from './types.ts'
 * @import { Vec } from '../../../types/bit_vec/types.ts'
 */

import { bitGroupDemo, bitGroups } from './module.f.mjs'
import { htmlToString } from '../../../media/html/module.f.mjs'
import { assert, assertEq, assertNotNullish } from '../../../asserts/module.f.mjs'
import { unwrap } from '../../../types/result/module.f.mjs'
import { runPure } from '../../../effects/module.f.mjs'
import { length, uint } from '../../../types/bit_vec/module.f.mjs'

/**
 * A toy codec, so these proofs are about drawing the groups and not about
 * any real one: three-bit groups filled with zeros, and an "encoding" that
 * spells the input's length and value, one character per group.
 *
 * @type {BitScheme}
 */
const scheme = { width: 3, count: n => Math.ceil(n / 3), fill: k => '0'.repeat(k) }

/** @type {(v: Vec) => string} */
const encode = v => `${length(v)}:${uint(v)}`

const f = bitGroups(scheme, encode)

const demo = bitGroupDemo({ name: 'Toy', how: '3 bits per character', scheme, encode, note: 'the note' })

export const proof = {
    bitGroups: {
        // A short last group shows its fill after a `·`; whole groups
        // show none.
        groups: () => assertEq(JSON.stringify(f('h')), JSON.stringify({
            bytes: ['01101000'],
            groups: ['011', '010', '00·0'],
            encoded: '8:104',
        })),
        empty: () => assertEq(JSON.stringify(f('')), JSON.stringify({ bytes: [], groups: [], encoded: '0:0' })),
        // An unpaired surrogate has no UTF-8 bytes, so it is refused rather
        // than handed to the encoder.
        unpairedSurrogate: () => assertEq(f('a\uD800'), 'error: unpaired surrogate, no UTF-8'),
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
    view: {
        /**
         * **A character sits under its group**: the two are one table
         * column, the group in a data cell and the character in a header
         * cell, four groups to a row. `hé` is 24 bits, eight groups, so two
         * rows.
         */
        table: () => {
            const html = htmlToString(demo.view(demo.init))
            assert(html.includes('name="text"'), html)
            assert(html.includes('<pre>01101000 11000011 10101001</pre>'), html)
            assert(html.includes('<strong>Toy</strong> — 3 bits per character'), html)
            assert(html.includes('<tr><td>011</td><td>010</td><td>001</td><td>100</td></tr><tr><th>2</th><th>4</th><th>:</th><th>6</th></tr>'), html)
            assert(html.includes('Result: <strong>24:6865833</strong>'), html)
            assert(html.includes('<p>the note</p>'), html)
        },
        // No bits, no groups: no table, and `(empty)` rather than nothing.
        empty: () => {
            const html = htmlToString(demo.view(''))
            assert(html.includes('<pre>(empty)</pre>'), html)
            assert(!html.includes('<table>'), html)
            assert(html.includes('Result: <strong>0:0</strong>'), html)
        },
        unpairedSurrogate: () => {
            const html = htmlToString(demo.view('a\uD800'))
            assert(html.includes('<strong>error: unpaired surrogate, no UTF-8</strong>'), html)
            assert(!html.includes('<table>'), html)
        },
    },
}
