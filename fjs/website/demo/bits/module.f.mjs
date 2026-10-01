/**
 * The shared half of every demo that shows a base-N codec at work: a text
 * field, its UTF-8 bytes in binary, and the same bits cut into the codec's
 * groups, with the character the codec wrote for each group under it.
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
 * **Each encoding is a table.** The site sets everything in one monospace
 * face, so a group's bits and its character would look alike as lines of
 * text. In a table the character sits in a header cell under its group,
 * which a browser bolds and centres.
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
 * @import { BitGroupDemoOptions, BitGroups, BitScheme } from './types.ts'
 */

import { fromCodePointList } from '../../../text/utf8/module.f.mjs'
import { stringToCodePointList } from '../../../text/utf16/module.f.mjs'
import { isValidCodePoint } from '../../../text/code_point/module.f.mjs'
import { u8ListToVecMsb } from '../../../types/bit_vec/module.f.mjs'
import { toArray } from '../../../types/list/module.f.mjs'
import { textDemo } from '../module.f.mjs'

/**
 * The UTF-8 bytes of `text`, or `null` if it holds an unpaired surrogate.
 *
 * @type {(text: string) => Nullable<readonly number[]>}
 */
const utf8Bytes = text => {
    const cps = toArray(stringToCodePointList(text))
    return cps.every(isValidCodePoint) ? toArray(fromCodePointList(cps)) : null
}

/**
 * The groups `scheme` cuts `bits` into, each as its bits, with any fill bits
 * after a `·`.
 *
 * @type {(scheme: BitScheme) => (bits: string) => readonly string[]}
 */
const groups = ({ width, count, fill }) => bits =>
    Array.from({ length: count(bits.length) }, (_, i) => {
        const data = bits.slice(i * width, (i + 1) * width)
        return data.length === width ? data : `${data}·${fill(width - data.length)}`
    })

/**
 * What the demo shows for `text`: its UTF-8 bytes in binary, the groups
 * `scheme` cuts them into, and what `encode` wrote — or why there is none.
 *
 * @type {(scheme: BitScheme, encode: (v: Vec) => string) => (text: string) => BitGroups | string}
 */
export const bitGroups = (scheme, encode) => text => {
    const bytes = utf8Bytes(text)
    if (bytes === null) { return 'error: unpaired surrogate, no UTF-8' }
    const binary = bytes.map(x => x.toString(2).padStart(8, '0'))
    return {
        bytes: binary,
        groups: groups(scheme)(binary.join('')),
        encoded: encode(u8ListToVecMsb(bytes)),
    }
}

/** Groups per row: four Base64 groups are three bytes, one whole quantum. */
const perRow = 4

/** @type {(tag: string) => (text: string) => Element} */
const cell = tag => text => [tag, text]

/**
 * A table of the groups, four to a row: each group's bits, and under them,
 * in a header cell, the character the codec wrote for it.
 *
 * @type {(g: BitGroups) => Element}
 */
const table = ({ groups, encoded }) => {
    /** @type {(r: number) => readonly Element[]} */
    const rowPair = r => {
        const row = groups.slice(r * perRow, (r + 1) * perRow)
        return [
            ['tr', ...row.map(cell('td'))],
            ['tr', ...row.map((_, i) => cell('th')(encoded[r * perRow + i]))],
        ]
    }
    return ['table', ...Array.from({ length: Math.ceil(groups.length / perRow) }, (_, r) => rowPair(r)).flat()]
}

/** @type {(s: string) => string} */
const orEmpty = s => s === '' ? '(empty)' : s

/**
 * A demo of one codec: the text, its bytes, the codec's name in bold and how
 * it cuts the bits, the table, the whole result in bold, and the note.
 *
 * The initial text is three bytes, one whole Base64 quantum and not a whole
 * number of five-bit groups, so one text shows a codec that needs no fill
 * and one that does.
 *
 * @type {(o: BitGroupDemoOptions) => Demo<string, DemoEvent>}
 */
export const bitGroupDemo = ({ name, how, scheme, encode, note }) => {
    const f = bitGroups(scheme, encode)
    return textDemo({ name: 'text', label: 'Text', rows: 2, init: 'hé' })(text => {
        const g = f(text)
        /** @type {readonly Node[]} */
        const view = typeof g === 'string' ? [['p', ['strong', g]]] : [
            ['p', ['strong', 'UTF-8 bytes'], ' — binary'],
            ['pre', orEmpty(g.bytes.join(' '))],
            ['p', ['strong', name], ` — ${how}`],
            ...(g.groups.length === 0 ? [] : [table(g)]),
            ['p', 'Result: ', ['strong', orEmpty(g.encoded)]],
            ['p', note],
        ]
        return view
    })
}
