/**
 * @import { Id } from './id/types.ts'
 * @import { Add } from './level/hash/types.ts'
 * @import { DemoEvent } from '../website/demo/types.ts'
 * @import { _DemoState, EncodeState } from './types.ts'
 */

import { assert, assertEq, assertError, assertNotNullish, assertOk } from '../asserts/module.f.js'
import { compress, level3Id } from './id/module.f.mjs'
import { encode, emptyEncodeState } from './module.f.mjs'
import { demo, examples, maxBits, rowWords, stripes, units } from './demo.f.mjs'
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

/** @type {(text: string) => readonly bigint[]} */
const bitsOf = text => [...text].flatMap(c => [...c.charCodeAt(0).toString(2).padStart(8, '0')].map(b => BigInt(b)))

const heightEncoder = encode(() => null)

/**
 * `text`'s bits pushed with `pushWithHeight`, then ended with
 * `endWithHeights`: each input bit's height, each padding bit's, the root,
 * and what `end` answers for the same state.
 *
 * @type {(text: string) => readonly [readonly number[], readonly number[], Id, Id]}
 */
const heightsOf = text => {
    const { pushWithHeight, endWithHeights, end } = heightEncoder
    /** @type {readonly [readonly number[], EncodeState<null>]} */
    const start = [[], emptyEncodeState(null)]
    const [heights, state] = bitsOf(text).reduce(([hs, s], bit) => {
        const [h, next] = pushWithHeight(bit, s)
        return /** @type {const} */ ([[...hs, h], next])
    }, start)
    const [padding, root] = endWithHeights(state)
    return [heights, padding, root, end(state)]
}

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

    // Padding can run to thousands of bits — 20,000 zeros take more than
    // 20,000 — and `end` pads in a loop, so the stack does not grow with it.
    longPadding: () => {
        const { push, end, endWithHeights } = encode(() => null)
        const state = zeros(20_000).reduce((s, b) => push(b, s), emptyEncodeState(null))
        const [heights, root] = endWithHeights(state)
        assert(heights.length > 20_000)
        assertEq(root, end(state))
    },

    /**
     * **Each bit's height is how many levels close a word on it.** `Hi` is
     * `01 00 100 00 11 01 00 1·1` in L1, its L2 words end on its 7th and
     * 11th bits, and the padding's one bit closes L1, L2 and L3 at once —
     * whose symbol opens H1 and is the root.
     */
    heights: {
        hi: () => {
            const [heights, padding, root, end] = heightsOf('Hi')
            assertEq(JSON.stringify(heights), JSON.stringify([0, 1, 0, 1, 0, 0, 2, 0, 1, 0, 2, 0, 1, 0, 1, 0]))
            assertEq(JSON.stringify(padding), JSON.stringify([3]))
            assertEq(root, end)
            assertEq(root, level3Id(0x4e94n))
        },
        // `Hello` reaches the hash levels: counting the bits whose height is at
        // least k counts level k's words, L1 to H2, and the last padding bit
        // closes all five, whose H2 symbol is the root.
        hello: () => {
            const [heights, padding, root, end] = heightsOf('Hello')
            const all = [...heights, ...padding]
            assertEq(padding.length, 57)
            assertEq(padding.at(-1), 5)
            assertEq([1, 2, 3, 4, 5, 6].map(k => all.filter(h => h >= k).length).join(), '45,21,9,4,1,0')
            assertEq(root, end)
        },
    },

    /**
     * **What the demo draws is pinned**: the words each literal level cuts
     * the bits into, the padding that closes L3's last word, and every input
     * the demo refuses.
     */
    demo: {
        // `Hi` is `01 00 100 00 11 01 00 1·1`: its heights are the encoder's,
        // its one padding bit closes L1, L2 and L3, and its root is that L3
        // symbol.
        hi: () => {
            const { padding, heights, root } = stripes('0100100001101001')
            assertEq(padding, '1')
            assertEq(JSON.stringify(heights), JSON.stringify([0, 1, 0, 1, 0, 0, 2, 0, 1, 0, 2, 0, 1, 0, 1, 0, 3]))
            assertEq(root, level3Id(0x4e94n))
            assertEq(JSON.stringify([1, 2, 3].map(k => rowWords(heights, k))), JSON.stringify([[2, 2, 3, 2, 2, 2, 2, 2], [7, 4, 6], [17]]))
        },
        // No input is all padding, a `1` and then `0`s until the root.
        empty: () => assertEq(stripes('').padding, '100000000000000'),
        // Every row's words cover the input and the padding exactly, up to
        // the root's, which covers them all.
        covers: () => {
            const { padding, heights } = stripes(bitsOf('Hello').join(''))
            const top = Math.max(...heights)
            for (const k of Array.from({ length: top }, (_, i) => i + 1)) {
                assertEq(rowWords(heights, k).reduce((a, b) => a + b, 0), 40 + padding.length)
            }
            assertEq(JSON.stringify(rowWords(heights, top)), JSON.stringify([40 + padding.length]))
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
                assertEq(assertError(units({ input: 'text', text: 'a'.repeat(maxBits / 8 + 1), bits: '' })), 'text too long: more than 128 UTF-8 bytes')
            },
            notBits: () => assertEq(assertError(units({ input: 'bits', text: '', bits: '012' })), 'bits are 0 and 1 only'),
            bitLimit: () => {
                assertEq(assertOk(units({ input: 'bits', text: '', bits: '0'.repeat(maxBits) })).length, maxBits / 8)
                assertEq(assertError(units({ input: 'bits', text: '', bits: '0'.repeat(maxBits + 1) })), 'too many bits: more than 1024')
            },
        },
        update: () => {
            /** @type {(state: _DemoState) => (event: DemoEvent) => _DemoState} */
            const next = state => event => unwrap(assertNotNullish(runPure(demo.update(state)(event))[0]))
            const bits = next(demo.init)({ kind: 'input', name: 'input', value: 'bits' })
            assertEq(JSON.stringify(bits), JSON.stringify({ ...demo.init, input: 'bits' }))
            assertEq(next(bits)({ kind: 'input', name: 'bits', value: '1' }).bits, '1')
            // A pick fills the text field and shows it, even over typed bits.
            const picked = next(bits)({ kind: 'input', name: 'example', value: 'Two bytes' })
            assertEq(JSON.stringify(picked), JSON.stringify({ ...bits, input: 'text', text: 'Hi' }))
        },
        view: {
            // The initial text: its characters over their bits, a row of
            // pixels per level, the padding as a unit of its own, and the count.
            // `Hello`: its characters over their bits, a row of pixels per
            // level, the padding as units of its own, and the count — all
            // raw, so nothing is hatched.
            word: () => {
                const h = htmlToString(demo.view({ ...demo.init, text: 'Hello' }))
                assert(h.includes('<input type="radio" id="input-text" name="input" value="text" checked="">'), h)
                assert(h.includes('<input type="text" id="text" name="text" value="Hello">'), h)
                assert(h.includes('<span data-sul-label="">H</span>'), h)
                assert(h.includes('<div data-sul-unit="" data-sul-pad=""><span data-sul-label="" data-stand-in="">end</span>'), h)
                assert(h.includes('<span data-sul-bit="" data-bit="stop">1</span>'), h)
                assert(h.includes('<span data-sul-px="a"></span>') && h.includes('<span data-sul-px="b"></span>'), h)
                assert(h.includes('40 input bits and 57 padding bits: L1 45, L2 21, L3 9, H1 4, H2 1 words.'), h)
                assert(h.includes('<p data-caption="">Root, raw, its bits held inline:</p>'), h)
                assert(!h.includes('data-sul-hash'), h)
            },
            bits: () => {
                const h = htmlToString(demo.view({ ...demo.init, input: 'bits' }))
                assert(h.includes('<input type="text" id="bits" name="bits" value="0100100001101001">'), h)
                assert(h.includes('16 input bits and 1 padding bits: L1 8, L2 3, L3 1 words.'), h)
                assert(h.includes('<p data-caption="">Root, an L3 symbol:</p>'), h)
                assert(h.includes(`<pre>0x${'4e94'.padStart(64, '0')}</pre>`), h)
            },
            // The longest text reaches the hash levels' hashes: a stripe wider
            // than 253 bits is hatched, and the root is a hash. (`init`
            // checks that `Hello`, all of whose stripes are narrower, has
            // none.)
            hashes: () => {
                const h = htmlToString(demo.view({ ...demo.init, text: 'a'.repeat(maxBits / 8) }))
                assert(h.includes('<span data-sul-px="a" data-sul-hash=""></span>'), h)
                assert(h.includes('<div data-sul-row="">H6</div>'), h)
                assert(h.includes('<p data-caption="">Root, a hash:</p>'), h)
            },
            // The padding is units of eight bits, the first labelled `end`.
            padding: () => {
                const h = htmlToString(demo.view(demo.init))
                assert(h.includes('<div data-sul-unit="" data-sul-pad=""><span data-sul-label=""></span>'), h)
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
            // The demo opens on the overview, selected in the drop-down: hashing
            // starts inside a row, so both raw and hashed stripes show.
            init: () => {
                const h = htmlToString(demo.view(demo.init))
                assert(h.includes('<option value="Overview" selected="">Overview</option>'), h)
                assert(h.includes('data-sul-hash'), h)
                assert(h.includes('<p data-caption="">Root, a hash:</p>'), h)
            },
            // Every example is drawn, none refused, and selected when shown.
            examples: () => {
                for (const [name, text] of examples) {
                    const h = htmlToString(demo.view({ ...demo.init, text }))
                    assert(h.includes(`<option value="${name}" selected="">${name}</option>`), h)
                    assert(h.includes('data-sul-units'), h)
                    assert(!h.includes('data-result="error"'), h)
                }
            },
            // Over typed bits there is no drop-down: its examples are texts.
            noExamplesOverBits: () => assert(!htmlToString(demo.view({ ...demo.init, input: 'bits' })).includes('id="example"')),
            refused: () => {
                const h = htmlToString(demo.view({ ...demo.init, input: 'bits', bits: '2' }))
                assert(h.includes('<pre data-result="error">bits are 0 and 1 only</pre>'), h)
                assert(!h.includes('data-sul-units'), h)
            },
        },
    },
}
