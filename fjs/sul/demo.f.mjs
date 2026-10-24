/**
 * SUL's levels as stripes: a text, or typed bits, and under every bit a
 * pixel for each level from L1 up to the root, its colour switching where
 * that level's word ends.
 *
 * **A stripe is the run of input bits one symbol encodes.** L1 cuts bits
 * into words, L2 cuts L1's symbols, and so on up: L3, then the hash levels
 * H1, H2, … until one symbol is left, the root. A word's bits are the bits of
 * the symbols it holds, so each level's stripes are wider than the one's
 * below and every row spans the whole input. `Hi` is
 * `01 00 100 00 11 01 00 1·1`: eight L1 words, three L2 words and one L3
 * word, which is its root.
 *
 * **The stripes are the encoder's own.** Each bit's height — how many levels
 * close a word on it — comes from `pushWithHeight` and `endWithHeights`
 * ([`module.f.mjs`](./module.f.mjs)); the demo only draws them.
 *
 * **A hash level's symbol is raw or a hash.** It holds the bits it covers
 * inline while they fit in 253, and is a hash once they do not
 * ([`id/module.f.mjs`](./id/module.f.mjs)'s `isHashLength`); a hash stripe is
 * hatched, so a reader sees where hashing starts. The root is written out.
 *
 * **The bits are padded as `end` pads them**: a `1`, then `0`s, until a
 * symbol opens a level of its own — the root. The padding can be longer than
 * the input; it is drawn in full, faded, as the bit-group demos draw a stop
 * bit and fill.
 *
 * **The rows are one line that scrolls sideways**, so no stripe breaks, and
 * the rows' names stay in view.
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
 * **Input is limited to 128 bytes**, so hashing shows inside the rows and the
 * line stays a length a page can scroll; longer input is refused rather than
 * cut short.
 *
 * @module
 *
 * @import { Demo, DemoEvent } from '../website/demo/types.ts'
 * @import { Element, Node } from '../media/html/types.ts'
 * @import { Result } from '../types/result/types.ts'
 * @import { Examples } from '../website/demo/examples/types.ts'
 * @import { _DemoState, _DemoStripes, _DemoUnit, EncodeState } from './types.ts'
 */

import { encode, emptyEncodeState } from './module.f.mjs'
import { levels } from './level/literal/module.f.mjs'
import { isHash, isHashLength, isRaw } from './id/module.f.mjs'
import { byteChars } from '../website/demo/bits/module.f.mjs'
import { caption, fieldUpdate, inputField, radios, refusal } from '../website/demo/module.f.mjs'
import { codeBlock } from '../website/demo/code/module.f.js'
import { examplePicker, name as exampleName } from '../website/demo/examples/module.f.js'
import { pureOk } from '../effects/module.f.mjs'
import { asBase } from '../types/nominal/module.f.js'
import { error, ok } from '../types/result/module.f.js'

/** The most input bits the demo draws: 128 bytes. */
export const maxBits = 0x400

const { pushWithHeight, endWithHeights } = encode(() => null)

/**
 * What the encoder says about `bits`, a string of `0` and `1`: the padding
 * `end` adds, each bit's height, the input's then the padding's, and the root.
 *
 * @type {(bits: string) => _DemoStripes}
 */
export const stripes = bits => {
    /** @type {readonly [readonly number[], EncodeState<null>]} */
    const start = [[], emptyEncodeState(null)]
    const [heights, state] = [...bits].reduce(([hs, s], b) => {
        const [h, next] = pushWithHeight(BigInt(b), s)
        return /** @type {const} */ ([[...hs, h], next])
    }, start)
    const [padding, root] = endWithHeights(state)
    return { padding: '1'.padEnd(padding.length, '0'), heights: [...heights, ...padding], root }
}

/**
 * The length in bits of each word of row `k`, L1 being 1: a word of it ends
 * on each bit whose height is at least `k`.
 *
 * @type {(heights: readonly number[], k: number) => readonly number[]}
 */
export const rowWords = (heights, k) => heights.reduce(
    /** @type {(acc: readonly [readonly number[], number], h: number) => readonly [readonly number[], number]} */
    ([words, run], h) => h >= k ? [[...words, run + 1], 0] : [words, run + 1],
    [[], 0])[0]

/** @type {(k: number) => string} */
const rowName = k => k <= levels.length ? `L${k}` : `H${k - levels.length}`

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
 * One pixel per bit of row `k`, given its words: whether the bit is in an odd
 * word, the colour it takes, and whether that word's symbol is a hash, which
 * only a hash level's can be.
 *
 * @type {(words: readonly number[], k: number) => readonly Element[]}
 */
const rowPixels = (words, k) => words.flatMap((length, j) => {
    /** @type {Element} */
    const px = ['span', {
        'data-sul-px': j % 2 === 1 ? 'b' : 'a',
        ...(k > levels.length && isHashLength(length) ? { 'data-sul-hash': '' } : {}),
    }]
    return Array.from({ length }, () => px)
})

/**
 * One unit: its label over its bits, then its part of each row. `from` is
 * where its bits start; a unit from bit `n` on is padding, whose bits are
 * marked as a stop bit and fill, and itself, so the stylesheet can fade its
 * pixels.
 *
 * @type {(rows: readonly (readonly Element[])[], n: number) => (unit: _DemoUnit, from: number) => Element}
 */
const unitView = (rows, n) => ({ label, standIn, bits }, from) => ['div', from >= n ? { 'data-sul-unit': '', 'data-sul-pad': '' } : { 'data-sul-unit': '' },
    ['span', standIn ? { 'data-sul-label': '', 'data-stand-in': '' } : { 'data-sul-label': '' }, label],
    ['div', { 'data-sul-row': '' }, ...[...bits].map((b, i) => /** @type {Element} */ (['span',
        from >= n ? { 'data-sul-bit': '', 'data-bit': from + i === n ? 'stop' : 'fill' } : { 'data-sul-bit': '' }, b]))],
    ...rows.map(row => /** @type {Element} */ (['div', { 'data-sul-row': '' }, ...row.slice(from, from + bits.length)])),
]

/**
 * The rows' names, drawn as the first unit so they line up with the rows.
 *
 * @type {(names: readonly string[]) => Element}
 */
const namesView = names => ['div', { 'data-sul-unit': '', 'data-sul-names': '' },
    ['span', { 'data-sul-label': '' }],
    ...['bits', ...names].map(name => /** @type {Element} */ (['div', { 'data-sul-row': '' }, name])),
]

/**
 * The padding as units of eight bits, the first labelled `end`.
 *
 * @type {(padding: string) => readonly _DemoUnit[]}
 */
const paddingUnits = padding => Array.from({ length: Math.ceil(padding.length / 8) }, (_, i) => ({
    label: i === 0 ? 'end' : '',
    standIn: i === 0,
    bits: padding.slice(i * 8, (i + 1) * 8),
}))

/**
 * What the root is: a hash, the bits it covers held inline, or the one L3
 * symbol a short input makes.
 *
 * @type {(root: _DemoStripes['root']) => string}
 */
const rootKind = root => isHash(root) ? 'a hash' : isRaw(root) ? 'raw, its bits held inline' : 'an L3 symbol'

/**
 * The stripes for `units`, and the padding's after them, on one line that
 * scrolls; how many words each row has; and the root.
 *
 * @type {(units: readonly _DemoUnit[]) => readonly Node[]}
 */
const stripesView = units => {
    const n = bitCount(units)
    const { padding, heights, root } = stripes(units.map(({ bits }) => bits).join(''))
    const ks = Array.from({ length: Math.max(...heights) }, (_, i) => i + 1)
    const words = ks.map(k => rowWords(heights, k))
    const rows = ks.map((k, i) => rowPixels(words[i], k))
    const names = ks.map(rowName)
    const all = [...units, ...paddingUnits(padding)]
    const froms = all.map((_, i) => bitCount(all.slice(0, i)))
    const unit = unitView(rows, n)
    return [
        caption('Words, level by level:'),
        ['div', { 'data-sul-scroll': '' },
            ['div', { 'data-sul-units': '' }, namesView(names), ...all.map((u, i) => unit(u, froms[i]))],
        ],
        ['p', `${n} input bits and ${padding.length} padding bits: ${names.map((name, i) => `${name} ${words[i].length}`).join(', ')} words.`],
        caption(`Root, ${rootKind(root)}:`),
        codeBlock(`0x${asBase(root).toString(16).padStart(64, '0')}`, 'Copy the root'),
    ]
}

const intro = 'Cuts bits into SUL words, level by level, up to one symbol, the root: L1 words are made of bits, L2 words of L1 symbols, and so on through L3 and the hash levels H1, H2 and up. Each row switches colour where a word ends, so a stripe is the run of input bits one symbol encodes; a hatched stripe is a hash, the others hold their bits inline. After the input, a 1 and then 0s pad the bits until the root. Compare the L1 row with the L1 table in levels.md: 00, 01, 100, 101 and 11.'

/**
 * The texts the drop-down offers, each one showing what the others cannot.
 * The first, which the demo opens on, is the shortest text found whose
 * stripes show hashing start inside a row: one H row holds both raw and
 * hashed stripes. The others: a root that is the one L3 symbol, a raw root
 * with more padding than input, hashing up to the top at the limit,
 * characters of two, three and four bytes, and no input, all padding.
 *
 * @type {Examples}
 */
export const examples = [
    ['Overview', 'Hello, world! SUL is a universal encoding.'],
    ['Two bytes', 'Hi'],
    ['A word', 'Hello'],
    ['The longest text', 'SUL maps any finite sequence of bits to one root: bits make words, words make symbols, and once a word is too long it is hashed.'],
    ['Characters of several bytes', 'é € 😀'],
    ['Empty', ''],
]

const picker = examplePicker(examples)

/** @type {Demo<_DemoState, DemoEvent>} */
export const demo = {
    init: { input: 'text', text: picker.pick('Overview'), bits: '0100100001101001' },
    // A pick is a text: it fills the text field and shows it.
    update: state => event => event.kind === 'input' && event.name === exampleName
        ? pureOk({ ...state, input: 'text', text: picker.pick(event.value) })
        : fieldUpdate(state)(event),
    view: state => {
        const [kind, u] = units(state)
        return ['div',
            ['p', intro],
            radios('input', 'Input', [{ value: 'text', label: 'UTF-8 text' }, { value: 'bits', label: 'Bits' }], state.input),
            // The examples are texts, so they are offered over the text field
            // only: over typed bits, the one selected would be a text not shown.
            ...(state.input === 'bits'
                ? [inputField({ name: 'bits', label: 'Bits' }, state.bits)]
                : [picker.view(state.text), inputField({ name: 'text', label: 'Text' }, state.text)]),
            ...(kind === 'error' ? [refusal(u)] : stripesView(u)),
        ]
    },
}
