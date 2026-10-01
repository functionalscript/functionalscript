/**
 * @import { DemoEvent } from '../types.ts'
 * @import { Vec } from '../../../types/bit_vec/types.ts'
 * @import { BitGroups, BitScheme } from './types.ts'
 */

import { bitGroupDemo, bitGroups } from './module.f.mjs'
import { htmlToString } from '../../../media/html/module.f.mjs'
import { assert, assertEq, assertNotNullish } from '../../../asserts/module.f.mjs'
import { unwrap } from '../../../types/result/module.f.mjs'
import { runPure } from '../../../effects/module.f.mjs'
import { length, uint } from '../../../types/bit_vec/module.f.mjs'

/**
 * A toy codec, so these proofs are about drawing the groups and not about any
 * real one: an "encoding" that spells the input's length and value, one
 * character per group.
 *
 * @type {(v: Vec) => string}
 */
const encode = v => `${length(v)}:${uint(v)}`

/** Three-bit groups filled with zeros, and with a stop bit. */
/** @type {BitScheme} */
const zeros = { width: 3, stop: false }
/** @type {BitScheme} */
const stops = { width: 3, stop: true }
/** @type {BitScheme} */
const blocks = { width: 3, stop: false, block: 2 }

/** @type {(scheme: BitScheme) => (text: string) => BitGroups} */
const encoded = scheme => text => {
    const g = bitGroups(scheme, encode)(text)
    if (typeof g === 'string') { throw g }
    return g
}

const zeroDemo = bitGroupDemo({ name: 'Toy', how: '3 bits per character', scheme: zeros, encode, note: 'the note' })
const stopDemo = bitGroupDemo({ name: 'Stop', how: '3 bits, then a stop bit', scheme: stops, encode, note: 'the note' })
const blockDemo = bitGroupDemo({ name: 'Block', how: '3 bits, 2 to a block', scheme: blocks, encode, note: 'the note' })

export const proof = {
    bitGroups: {
        // A short last group is completed with zeros; whole groups need
        // nothing.
        zeros: () => assertEq(JSON.stringify(bitGroups(zeros, encode)('h')), JSON.stringify({
            bytes: ['01101000'],
            groups: [
                { data: '011', stop: '', fill: '' },
                { data: '010', stop: '', fill: '' },
                { data: '00', stop: '', fill: '0' },
            ],
            encoded: '8:104',
        })),
        // With a stop bit, the short last group takes a `1` before its
        // zeros, and data that fills its groups exactly gets one more, the
        // stop bit and zeros alone: `hé` is 24 bits, eight whole groups.
        stops: () => {
            const h = encoded(stops)('h')
            assertEq(JSON.stringify(h.groups.at(-1)), JSON.stringify({ data: '00', stop: '1', fill: '' }))
            const he = encoded(stops)('hé')
            assertEq(he.groups.length, 9)
            assertEq(JSON.stringify(he.groups.at(-1)), JSON.stringify({ data: '', stop: '1', fill: '00' }))
        },
        empty: () => {
            assertEq(JSON.stringify(bitGroups(zeros, encode)('')), JSON.stringify({ bytes: [], groups: [], encoded: '0:0' }))
            assertEq(JSON.stringify(encoded(stops)('').groups), JSON.stringify([{ data: '', stop: '1', fill: '00' }]))
        },
        // An unpaired surrogate has no UTF-8 bytes, so it is refused rather
        // than handed to the encoder.
        unpairedSurrogate: () => assertEq(bitGroups(zeros, encode)('a\uD800'), 'error: unpaired surrogate, no UTF-8'),
    },
    // Typing replaces the text; every other event leaves it alone.
    update: () => {
        /** @type {(event: DemoEvent) => (state: string) => string} */
        const step = event => state => unwrap(assertNotNullish(
            runPure(zeroDemo.update(state)(event))[0],
            'expected the demo to reach a value without asking for an operation'))
        assertEq(step({ kind: 'input', name: 'text', value: 'a' })(''), 'a')
        assertEq(step({ kind: 'start' })('kept'), 'kept')
    },
    view: {
        /**
         * **A character sits under its group**: each group is a
         * `data-bit-box`, its bits over its character, and without a block
         * size the boxes are the `data-bit-groups` container's own children,
         * so they wrap anywhere.
         */
        boxes: () => {
            const html = htmlToString(zeroDemo.view(zeroDemo.init))
            assert(html.includes('name="text"'), html)
            assert(html.includes('<pre>01101000 11000011 10101001</pre>'), html)
            assert(html.includes('<strong>Toy</strong> — 3 bits per character'), html)
            assert(html.includes('<div data-bit-groups=""><div data-bit-box=""><span>011</span><span data-bit-char="">2</span></div><div data-bit-box=""><span>010</span><span data-bit-char="">4</span></div>'), html)
            assert(!html.includes('data-bit-block'), html)
            assert(html.includes('Result: <strong>24:6865833</strong>'), html)
            assert(html.includes('<p>the note</p>'), html)
        },
        /**
         * **With a block size, the boxes go in blocks**, which wrap as units:
         * `h` is three groups, so a block of two and a last block of one.
         */
        blocks: () => {
            const html = htmlToString(blockDemo.view('h'))
            const box = (/** @type {string} */ bits, /** @type {string} */ c) =>
                `<div data-bit-box=""><span>${bits}</span><span data-bit-char="">${c}</span></div>`
            assert(html.includes(`<div data-bit-groups="" data-bit-blocks=""><div data-bit-block="">${box('011', '8')}${box('010', ':')}</div><div data-bit-block=""><div data-bit-box=""><span>00<span data-bit="fill">0</span></span><span data-bit-char="">1</span></div></div></div>`), html)
        },
        /**
         * **Stop and fill bits are marked**, so the stylesheet sets them
         * apart from the data, and the legend names each kind the scheme
         * has: a scheme without a stop bit does not mention one.
         */
        marked: () => {
            const zero = htmlToString(zeroDemo.view('h'))
            assert(zero.includes('<span>00<span data-bit="fill">0</span></span>'), zero)
            assert(zero.includes('<p><span data-bit="fill">0</span> fill bits carry no data</p>'), zero)
            const stop = htmlToString(stopDemo.view(stopDemo.init))
            assert(stop.includes('<span><span data-bit="stop">1</span><span data-bit="fill">00</span></span>'), stop)
            assert(stop.includes('<span data-bit="fill">0</span> fill bits carry no data; <span data-bit="stop">1</span> is the stop bit'), stop)
        },
        // No bits, no groups: no boxes, and `(empty)` rather than nothing.
        empty: () => {
            const html = htmlToString(zeroDemo.view(''))
            assert(html.includes('<pre>(empty)</pre>'), html)
            assert(!html.includes('data-bit-groups'), html)
            assert(html.includes('Result: <strong>0:0</strong>'), html)
        },
        unpairedSurrogate: () => {
            const html = htmlToString(zeroDemo.view('a\uD800'))
            assert(html.includes('<strong>error: unpaired surrogate, no UTF-8</strong>'), html)
            assert(!html.includes('data-bit-groups'), html)
        },
    },
}
