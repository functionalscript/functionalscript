/**
 * SUL's literal levels as stripes: a text, or typed bits, and under every
 * bit a pixel for each of L1, L2 and L3, its colour switching where that
 * level's word ends.
 *
 * **A stripe is the run of input bits one symbol encodes.** L1 cuts bits
 * into words, L2 cuts L1's symbols, L3 cuts L2's, and a word's bits are the
 * bits of the symbols it holds, so each level's stripes are wider than the
 * one's below and every row spans the whole input. `Hi` is
 * `01 00 100 00 11 01 00 1`: eight L1 words, three L2 words and one L3 word.
 *
 * **The bits are padded until L3 closes a word**, as SUL's `end` pads them:
 * a `1`, then `0`s. `end` goes on until the hash levels above close too; the
 * demo draws only the literal levels, so it stops at L3. The padding is
 * drawn as the bit-group demos draw a stop bit and fill.
 *
 * **The result can be checked by hand**: the first row against the L1 table
 * in [`levels.md`](./level/literal/levels.md), whose words are `00`, `01`,
 * `100`, `101` and `11`.
 *
 * **The demo is visual.** A word's ends are shown only by its stripe's
 * colour: a screen reader reads the bits and the rows' names, not where the
 * words end. Writing the words out as text was considered and left out, as
 * the stripes are the demo's point.
 *
 * **Input is limited to 256 bits**, so the stripes stay a size a page can
 * show; longer input is refused rather than cut short.
 *
 * @module
 *
 * @import { Demo, DemoEvent } from '../website/demo/types.ts'
 * @import { Element, Node } from '../media/html/types.ts'
 * @import { Result } from '../types/result/types.ts'
 * @import { _DemoLevel, _DemoState, _DemoStripes, _DemoUnit } from './types.ts'
 */

import { emptyEncodeState, levels } from './level/literal/module.f.mjs'
import { byteChars } from '../website/demo/bits/module.f.mjs'
import { caption, fieldUpdate, inputField, radios, refusal } from '../website/demo/module.f.mjs'
import { error, ok } from '../types/result/module.f.js'

/** The most input bits the demo draws: 32 bytes. */
export const maxBits = 0x100

/** @type {readonly _DemoLevel[]} */
const initLevels = levels.map(() => ({ state: emptyEncodeState, start: 0, words: [] }))

/**
 * Feeds `symbol` to level `i`; `end` is the bit after the last one it
 * encodes. A word the level closes ends there, and its symbol is fed to the
 * next level. `true` when L3 closed a word.
 *
 * @type {(ls: readonly _DemoLevel[], i: number, symbol: bigint, end: number) => readonly [boolean, readonly _DemoLevel[]]}
 */
const feed = (ls, i, symbol, end) => {
    if (i === ls.length) { return [true, ls] }
    const { state, start, words } = ls[i]
    const [out, next] = levels[i].encode(symbol, state)
    return out === undefined
        ? [false, ls.with(i, { state: next, start, words })]
        : feed(ls.with(i, { state: next, start: end, words: [...words, end - start] }), i + 1, out, end)
}

/**
 * How the literal levels cut `bits`, a string of `0` and `1`, into words:
 * each level's word lengths, after the input is padded with a `1` and then
 * `0`s until L3 closes a word.
 *
 * @type {(bits: string) => _DemoStripes}
 */
export const stripes = bits => {
    const input = [...bits].reduce((ls, b, i) => feed(ls, 0, BigInt(b), i + 1)[1], initLevels)
    /** @type {(ls: readonly _DemoLevel[], padding: string) => _DemoStripes} */
    const pad = (ls, padding) => {
        const bit = padding === '' ? '1' : '0'
        const p = padding + bit
        const [closed, next] = feed(ls, 0, BigInt(bit), bits.length + p.length)
        return closed ? { padding: p, words: next.map(({ words }) => words) } : pad(next, p)
    }
    return pad(input, '')
}

/** @type {(units: readonly _DemoUnit[]) => number} */
const bitCount = units => units.reduce((n, { bits }) => n + bits.length, 0)

/**
 * A text as units: each character over its UTF-8 bits. Refused: what UTF-8
 * cannot encode, and more than {@link maxBits} bits.
 *
 * @type {(text: string) => Result<readonly _DemoUnit[], string>}
 */
const textUnits = text => {
    const [kind, chars] = byteChars(text)
    if (kind === 'error') { return error(chars) }
    const units = chars.map(([, { label, standIn, bytes }]) => ({ label, standIn, bits: bytes.join('') }))
    return bitCount(units) > maxBits ? error(`text too long: more than ${maxBits / 8} UTF-8 bytes`) : ok(units)
}

/**
 * Typed bits as units of eight, the last one shorter if the bits run out.
 * Refused: anything but `0` and `1`, and more than {@link maxBits} bits.
 *
 * @type {(bits: string) => Result<readonly _DemoUnit[], string>}
 */
const bitUnits = bits =>
    ![...bits].every(c => c === '0' || c === '1') ? error('bits are 0 and 1 only')
    : bits.length > maxBits ? error(`too many bits: more than ${maxBits}`)
    : ok(Array.from({ length: Math.ceil(bits.length / 8) }, (_, i) => ({ label: '', standIn: false, bits: bits.slice(i * 8, (i + 1) * 8) })))

/**
 * The units the state's current input is drawn as, or why there are none.
 *
 * @type {(state: _DemoState) => Result<readonly _DemoUnit[], string>}
 */
export const units = ({ input, text, bits }) => input === 'bits' ? bitUnits(bits) : textUnits(text)

/**
 * For each bit, whether it is in an odd word of a level, given that level's
 * word lengths: the colour its pixel takes.
 *
 * @type {(words: readonly number[]) => readonly boolean[]}
 */
const parity = words => words.flatMap((length, k) => Array.from({ length }, () => k % 2 === 1))

/** @type {(odd: boolean) => Element} */
const pixel = odd => ['span', { 'data-sul-px': odd ? 'b' : 'a' }]

/**
 * One unit: its label over its bits, then a row of pixels for each level.
 * `from` is where its bits start; a padding unit marks its bits as a stop
 * bit and fill, and itself, so the stylesheet can fade its pixels.
 *
 * @type {(rows: readonly (readonly boolean[])[], unit: _DemoUnit, from: number, padding: boolean) => Element}
 */
const unitView = (rows, { label, standIn, bits }, from, padding) => ['div', padding ? { 'data-sul-unit': '', 'data-sul-pad': '' } : { 'data-sul-unit': '' },
    ['span', standIn ? { 'data-sul-label': '', 'data-stand-in': '' } : { 'data-sul-label': '' }, label],
    ['div', { 'data-sul-row': '' }, ...[...bits].map((b, i) => /** @type {Element} */ (['span',
        padding ? { 'data-sul-bit': '', 'data-bit': i === 0 ? 'stop' : 'fill' } : { 'data-sul-bit': '' }, b]))],
    ...rows.map(row => /** @type {Element} */ (['div', { 'data-sul-row': '' }, ...row.slice(from, from + bits.length).map(pixel)])),
]

/**
 * The rows' names, drawn as the first unit so they line up with the rows.
 *
 * @type {Element}
 */
const names = ['div', { 'data-sul-unit': '', 'data-sul-names': '' },
    ['span', { 'data-sul-label': '' }],
    ...['bits', 'L1', 'L2', 'L3'].map(name => /** @type {Element} */ (['div', { 'data-sul-row': '' }, name])),
]

/**
 * The stripes for `units`: the rows' names, every unit, and the padding as a
 * unit of its own, then how many words each level has.
 *
 * @type {(units: readonly _DemoUnit[]) => readonly Node[]}
 */
const stripesView = units => {
    const n = bitCount(units)
    const { padding, words } = stripes(units.map(({ bits }) => bits).join(''))
    const rows = words.map(parity)
    const froms = units.map((_, i) => bitCount(units.slice(0, i)))
    return [
        caption('Words, level by level:'),
        ['div', { 'data-sul-units': '' },
            names,
            ...units.map((u, i) => unitView(rows, u, froms[i], false)),
            unitView(rows, { label: 'end', standIn: true, bits: padding }, n, true),
        ],
        ['p', `${n} input bits and ${padding.length} padding bits: ${words.map((w, i) => `L${i + 1} ${w.length}`).join(', ')} words.`],
    ]
}

const intro = 'Cuts bits into SUL words, level by level: L1 words are made of bits, L2 words of L1 symbols, L3 words of L2 symbols. Each row switches colour where a word ends, so a stripe is the run of input bits one symbol encodes. After the input, a 1 and then 0s pad the bits until L3 closes its last word. Compare the L1 row with the L1 table in levels.md: 00, 01, 100, 101 and 11.'

/** @type {Demo<_DemoState, DemoEvent>} */
export const demo = {
    init: { input: 'text', text: 'Hello', bits: '0100100001101001' },
    update: fieldUpdate,
    view: state => {
        const [kind, u] = units(state)
        return ['div',
            ['p', intro],
            radios('input', 'Input', [{ value: 'text', label: 'UTF-8 text' }, { value: 'bits', label: 'Bits' }], state.input),
            state.input === 'bits'
                ? inputField({ name: 'bits', label: 'Bits' }, state.bits)
                : inputField({ name: 'text', label: 'Text' }, state.text),
            ...(kind === 'error' ? [refusal(u)] : stripesView(u)),
        ]
    },
}
