/**
 * @import { Id } from './id/types.ts'
 * @import { Add } from './level/hash/types.ts'
 * @import { DemoEvent } from '../website/demo/types.ts'
 * @import { _DemoState } from './types.ts'
 */

import { assert, assertEq, assertError, assertNotNullish, assertOk } from '../asserts/module.f.mjs'
import { compress } from './id/module.f.mjs'
import { encode, emptyEncodeState } from './module.f.mjs'
import { demo, maxBits, stripes, units } from './demo.f.mjs'
import { htmlToString } from '../media/html/module.f.mjs'
import { runPure } from '../effects/module.f.mjs'
import { unwrap } from '../types/result/module.f.js'

/** @type {(bits: readonly bigint[]) => readonly [Id, readonly (readonly [Id, Id, Id, boolean])[]]} */
const run = bits => {
    /** @type {(readonly [Id, Id, Id, boolean])[]} */
    const log = []
    /** @type {Add<null>} */
    const add = (l, r, m, isSymbol) => { log.push([l, r, m, isSymbol]); return null }
    const enc = encode(add)
    let s = emptyEncodeState(null)
    for (const b of bits) { s = enc.push(b, s) }
    return [enc.end(s), log]
}

/** @type {(bits: readonly bigint[]) => Id} */
const id = bits => run(bits)[0]

/** @type {(n: number) => readonly bigint[]} */
const zeros = n => new Array(n).fill(0n)

export const proof = {
    deterministic: () => {
        assertEq(id(zeros(16)), id(zeros(16)))
    },

    distinct: () => {
        assert(id([0n]) !== id([1n]))
    },

    orderMatters: () => {
        assert(id([0n, 1n]) !== id([1n, 0n]))
    },

    lengthMatters: () => {
        assert(id(zeros(8)) !== id(zeros(16)))
    },

    // Enough bits to trigger at least one hash merge
    hasMerges: () => {
        const [, log] = run(zeros(16))
        assert(log.length > 0)
    },

    // Every recorded merge satisfies merged === compress(left, right)
    compressCorrect: () => {
        const [, log] = run(zeros(16))
        for (const [l, r, m] of log) { assertEq(m, compress(l, r)) }
    },

    // Patricia-trie internal merges are isSymbol=false; terminal merges are isSymbol=true
    isSymbolTerminalOnly: () => {
        const [, log] = run(zeros(16))
        assert(log.some(([, , , isSymbol]) => isSymbol))
        assert(log.every(([l, r, m, isSymbol]) => !isSymbol || m === compress(l, r)))
    },

    /**
     * **What the demo draws is pinned**: the words each literal level cuts
     * the bits into, the padding that closes L3's last word, and every input
     * the demo refuses.
     */
    demo: {
        // `Hi` is `01 00 100 00 11 01 00 1`, its last L1 word closed by the
        // padding's `1`: eight L1 words, three L2 words, one L3 word.
        hi: () => assertEq(JSON.stringify(stripes('0100100001101001')),
            JSON.stringify({ padding: '1', words: [[2, 2, 3, 2, 2, 2, 2, 2], [7, 4, 6], [17]] })),
        // No input is all padding, a `1` and then `0`s until L3 closes.
        empty: () => assertEq(JSON.stringify(stripes('')),
            JSON.stringify({ padding: '100000000000000', words: [[3, 2, 2, 2, 2, 2, 2], [7, 4, 4], [15]] })),
        // Every level's words cover the input and the padding exactly.
        covers: () => {
            const bits = '0100100001100101011011000110110001101111'
            const { padding, words } = stripes(bits)
            for (const w of words) { assertEq(w.reduce((a, b) => a + b, 0), bits.length + padding.length) }
        },
        units: {
            text: () => assertEq(JSON.stringify(assertOk(units({ input: 'text', text: 'a é', bits: 'x' }))), JSON.stringify([
                { label: 'a', standIn: false, bits: '01100001' },
                { label: '␠', standIn: true, bits: '00100000' },
                { label: 'é', standIn: false, bits: '1100001110101001' },
            ])),
            bits: () => assertEq(JSON.stringify(assertOk(units({ input: 'bits', text: '\ud800', bits: '0100100001' }))), JSON.stringify([
                { label: '', standIn: false, bits: '01001000' },
                { label: '', standIn: false, bits: '01' },
            ])),
            surrogate: () => assertEq(assertError(units({ input: 'text', text: '\ud800', bits: '' })), 'unpaired surrogate, no UTF-8'),
            textLimit: () => {
                assertEq(assertOk(units({ input: 'text', text: 'a'.repeat(maxBits / 8), bits: '' })).length, maxBits / 8)
                assertEq(assertError(units({ input: 'text', text: 'a'.repeat(maxBits / 8 + 1), bits: '' })), 'text too long: more than 32 UTF-8 bytes')
            },
            notBits: () => assertEq(assertError(units({ input: 'bits', text: '', bits: '012' })), 'bits are 0 and 1 only'),
            bitLimit: () => {
                assertEq(assertOk(units({ input: 'bits', text: '', bits: '0'.repeat(maxBits) })).length, maxBits / 8)
                assertEq(assertError(units({ input: 'bits', text: '', bits: '0'.repeat(maxBits + 1) })), 'too many bits: more than 256')
            },
        },
        update: () => {
            /** @type {(state: _DemoState) => (event: DemoEvent) => _DemoState} */
            const next = state => event => unwrap(assertNotNullish(runPure(demo.update(state)(event))[0]))
            const bits = next(demo.init)({ kind: 'input', name: 'input', value: 'bits' })
            assertEq(JSON.stringify(bits), JSON.stringify({ ...demo.init, input: 'bits' }))
            assertEq(next(bits)({ kind: 'input', name: 'bits', value: '1' }).bits, '1')
        },
        view: {
            // The initial text: its characters over their bits, a row of
            // pixels per level, the padding as a unit of its own, and the count.
            init: () => {
                const h = htmlToString(demo.view(demo.init))
                assert(h.includes('<input type="radio" id="input-text" name="input" value="text" checked="">'), h)
                assert(h.includes('<input type="text" id="text" name="text" value="Hello">'), h)
                assert(h.includes('<span data-sul-label="">H</span>'), h)
                assert(h.includes('<div data-sul-unit="" data-sul-pad=""><span data-sul-label="" data-stand-in="">end</span>'), h)
                assert(h.includes('<span data-sul-bit="" data-bit="stop">1</span>'), h)
                assert(h.includes('<span data-sul-px="a"></span>') && h.includes('<span data-sul-px="b"></span>'), h)
                assert(h.includes('40 input bits and '), h)
            },
            bits: () => {
                const h = htmlToString(demo.view({ ...demo.init, input: 'bits' }))
                assert(h.includes('<input type="text" id="bits" name="bits" value="0100100001101001">'), h)
                assert(h.includes('16 input bits and 1 padding bits: L1 8, L2 3, L3 1 words.'), h)
            },
            // Each row is its own level, and each unit draws its own bits of
            // it. `Hi`'s L1 words are `01 00 100 00 11 01 00 1·1`, its L2
            // words 7, 4 and 6 bits long, and its L3 word all 17: the first
            // byte, the second, and the padding's one bit each show their
            // part of every row, in that order, under names in the same order.
            rowsAreLevels: () => {
                const h = htmlToString(demo.view({ ...demo.init, input: 'bits' }))
                /** @type {(pixels: string) => string} */
                const row = pixels => `<div data-sul-row="">${[...pixels].map(c => `<span data-sul-px="${c}"></span>`).join('')}</div>`
                /** @type {(l1: string, l2: string, l3: string) => string} */
                const unit = (l1, l2, l3) => `${row(l1)}${row(l2)}${row(l3)}</div>`
                assert(h.includes(unit('aabbaaab', 'aaaaaaab', 'aaaaaaaa')), h)
                assert(h.includes(unit('baabbaab', 'bbbaaaaa', 'aaaaaaaa')), h)
                assert(h.includes(unit('b', 'a', 'a')), h)
                assert(h.includes(['bits', 'L1', 'L2', 'L3'].map(name => `<div data-sul-row="">${name}</div>`).join('')), h)
            },
            refused: () => {
                const h = htmlToString(demo.view({ ...demo.init, input: 'bits', bits: '2' }))
                assert(h.includes('<pre data-result="error">bits are 0 and 1 only</pre>'), h)
                assert(!h.includes('data-sul-units'), h)
            },
        },
    },
}
