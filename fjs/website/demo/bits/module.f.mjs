/**
 * The shared half of every demo that shows a base-N codec at work: a text
 * field, each of its characters over its UTF-8 bytes in binary, and the same
 * bits cut into the codec's groups, with the character the codec wrote for
 * each group under it.
 *
 * **The bytes are drawn as the codec's groups are**, a bordered box per byte,
 * each character spanning its own: `é` visibly takes two, `€` three, and the
 * lead byte's high bits say how many. A character a reader could not see — a
 * space, a tab, a line break — is named by a muted stand-in such as `␠`.
 *
 * **The demo supplies its scheme and its encoder.** The scheme says how wide
 * a group is and how a short last group is filled, which is where codecs
 * differ; drawing the groups is the same for all of them, so one copy of it
 * is one place that can be wrong, not one per codec.
 *
 * **The groups are drawn here, the characters are the codec's own.** Each
 * character under a group is read from what `encode` returns, never computed
 * here, so a scheme that drew the groups wrong would show a mismatch rather
 * than agree with itself.
 *
 * **Each group is a box.** The site sets everything in one monospace face, so
 * a group's bits and its character would look alike as lines of text. A
 * bordered box pairs one group's bits with its character, shaded, under them;
 * stop and fill bits are marked so they read apart from the data. The boxes
 * wrap to the page's width, and a codec with blocks — Base64's four
 * characters, three bytes — keeps each block whole on a line. The look is the
 * stylesheet's, keyed on `data-bit-groups` and `data-bit`.
 *
 * **Text UTF-8 cannot encode is refused**: a JavaScript string can hold half
 * a surrogate pair, which has no UTF-8 bytes to encode (see `text/utf8`).
 *
 * @module
 *
 * @import { Demo, DemoEvent } from '../types.ts'
 * @import { Element, Node } from '../../../media/html/types.ts'
 * @import { Nullable } from '../../../types/nullable/types.ts'
 * @import { Vec } from '../../../types/bit_vec/types.ts'
 * @import { BitGroup, BitGroupDemoOptions, BitGroups, BitScheme, ByteChar } from './types.ts'
 * @import { CodePoint } from '../../../text/code_point/types.ts'
 */

import { fromCodePointList } from '../../../text/utf8/module.f.mjs'
import { codePointToString, stringToCodePointList } from '../../../text/utf16/module.f.mjs'
import { isValidCodePoint } from '../../../text/code_point/module.f.mjs'
import { u8ListToVecMsb } from '../../../types/bit_vec/module.f.mjs'
import { toArray } from '../../../types/list/module.f.mjs'
import { textDemo } from '../module.f.mjs'

/**
 * The stand-in a reader sees for a character they could not: `␠` for a space,
 * `↵` for a line break, `⇥` for a tab, and its code, `U+` and four hex digits,
 * for any other control character. `null` for a character that shows itself.
 *
 * @type {(cp: CodePoint) => string | null}
 */
const standIn = cp =>
    cp === 0x20 ? '␠'
    : cp === 0x0a ? '↵'
    : cp === 0x09 ? '⇥'
    : cp < 0x20 || (0x7f <= cp && cp <= 0x9f) ? `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`
    : null

/** @type {(b: number) => string} */
const binary = b => b.toString(2).padStart(8, '0')

/**
 * One character and its UTF-8 bytes, as numbers for the encoder and in binary
 * for the page.
 *
 * @type {(cp: CodePoint) => readonly [readonly number[], ByteChar]}
 */
const byteChar = cp => {
    const bytes = toArray(fromCodePointList([cp]))
    const s = standIn(cp)
    return [bytes, { label: s ?? codePointToString(cp), standIn: s !== null, bytes: bytes.map(binary) }]
}

/**
 * The groups `scheme` cuts `bits` into. Only the last can be short; it is
 * completed with the stop bit, if the scheme has one, and zeros.
 *
 * @type {(scheme: BitScheme) => (bits: string) => readonly BitGroup[]}
 */
const groups = ({ width, stop }) => bits => {
    const n = bits.length
    const count = stop ? Math.floor(n / width) + 1 : Math.ceil(n / width)
    return Array.from({ length: count }, (_, i) => {
        const data = bits.slice(i * width, (i + 1) * width)
        const rest = width - data.length
        return rest === 0 ? { data, stop: '', fill: '' }
            : stop ? { data, stop: '1', fill: '0'.repeat(rest - 1) }
            : { data, stop: '', fill: '0'.repeat(rest) }
    })
}

/**
 * What the demo shows for `text`: its UTF-8 bytes in binary, the groups
 * `scheme` cuts them into, and what `encode` wrote — or why there is none.
 *
 * @type {(scheme: BitScheme, encode: (v: Vec) => string) => (text: string) => BitGroups | string}
 */
export const bitGroups = (scheme, encode) => text => {
    const cps = toArray(stringToCodePointList(text))
    if (!cps.every(isValidCodePoint)) { return 'error: unpaired surrogate, no UTF-8' }
    const chars = cps.map(byteChar)
    const bytes = chars.flatMap(([b]) => b)
    return {
        chars: chars.map(([, c]) => c),
        groups: groups(scheme)(bytes.map(binary).join('')),
        encoded: encode(u8ListToVecMsb(bytes)),
    }
}

/**
 * One character as a unit: its bytes in binary, side by side, over the
 * character spanning them, so how many bytes it takes is plain to see. A
 * stand-in is marked, so the stylesheet can mute it.
 *
 * @type {(c: ByteChar) => Element}
 */
const charUnit = ({ label, standIn, bytes }) => ['div', { 'data-byte-char': '' },
    ['div', { 'data-byte-row': '' }, ...bytes.map(b => /** @type {Element} */ (['span', { 'data-byte': '' }, b]))],
    ['span', standIn ? { 'data-byte-label': '', 'data-stand-in': '' } : { 'data-byte-label': '' }, label],
]

/**
 * The text's characters, each with its bytes, wrapping to the page's width a
 * whole character at a time.
 *
 * @type {(chars: readonly ByteChar[]) => Element}
 */
const charUnits = chars => ['div', { 'data-byte-chars': '' }, ...chars.map(charUnit)]

/**
 * One group as a box: its bits — the data as text, then its stop and fill bits
 * each marked, so the stylesheet can set them apart from the data — over the
 * character the codec wrote for it.
 *
 * @type {(g: BitGroup, c: string) => Element}
 */
const box = ({ data, stop, fill }, c) => ['div', { 'data-bit-box': '' },
    ['span',
        data,
        ...(stop === '' ? [] : [/** @type {Element} */ (['span', { 'data-bit': 'stop' }, stop])]),
        ...(fill === '' ? [] : [/** @type {Element} */ (['span', { 'data-bit': 'fill' }, fill])]),
    ],
    ['span', { 'data-bit-char': '' }, c],
]

/**
 * The groups as boxes that wrap to the page's width. With a block size, the
 * boxes go in blocks of that many, which wrap as units: a line breaks only
 * between whole blocks, so a reader sees the codec's block without counting.
 * The stylesheet draws them by `data-bit-groups`.
 *
 * @type {(scheme: BitScheme) => (g: BitGroups) => Element}
 */
const boxes = ({ block }) => ({ groups, encoded }) => {
    const all = groups.map((g, i) => box(g, encoded[i]))
    if (block === undefined) { return ['div', { 'data-bit-groups': '' }, ...all] }
    return ['div', { 'data-bit-groups': '', 'data-bit-blocks': '' },
        ...Array.from({ length: Math.ceil(all.length / block) }, (_, i) =>
            /** @type {Element} */ (['div', { 'data-bit-block': '' }, ...all.slice(i * block, (i + 1) * block)]))]
}

/**
 * What the marked bits mean, in their own colours: fill, and the stop bit if
 * the scheme has one.
 *
 * @type {(scheme: BitScheme) => Element}
 */
const legend = ({ stop }) => ['p',
    ['span', { 'data-bit': 'fill' }, '0'], ' fill bits carry no data',
    ...(stop ? ['; ', /** @type {Element} */ (['span', { 'data-bit': 'stop' }, '1']), ' is the stop bit'] : []),
]

/** @type {(s: string) => string} */
const orEmpty = s => s === '' ? '(empty)' : s

/**
 * A demo of one codec: the text, its bytes, the codec's name in bold and how
 * it cuts the bits, the boxes, and the whole result in bold.
 *
 * The initial text is three bytes, one whole Base64 quantum and not a whole
 * number of five-bit groups, so one text shows a codec that needs no fill
 * and one that does.
 *
 * @type {(o: BitGroupDemoOptions) => Demo<string, DemoEvent>}
 */
export const bitGroupDemo = ({ name, how, scheme, encode }) => {
    const f = bitGroups(scheme, encode)
    const draw = boxes(scheme)
    return textDemo({ name: 'text', label: 'Text', rows: 2, init: 'hé' })(text => {
        const g = f(text)
        /** @type {readonly Node[]} */
        const view = typeof g === 'string' ? [['p', ['strong', g]]] : [
            ['p', ['strong', 'UTF-8 bytes'], ' — each character over its bytes'],
            g.chars.length === 0 ? ['p', '(empty)'] : charUnits(g.chars),
            ['p', ['strong', name], ` — ${how}`],
            ...(g.groups.length === 0 ? [] : [draw(g)]),
            legend(scheme),
            ['p', 'Result: ', ['strong', orEmpty(g.encoded)]],
        ]
        return view
    })
}
