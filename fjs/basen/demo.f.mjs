/**
 * Base64 and CBase32 as you type: a text field, its UTF-8 bits, and the same
 * bits cut into groups — six per Base64 character, five per CBase32 one — with
 * the character each group becomes under it.
 *
 * **Both encodings are `baseN` with a different width.** Same bits, a group
 * width and an alphabet: that is the whole factory in `module.f.mjs`, and the
 * demo shows the two side by side so the only differences left are the width
 * and how each one ends.
 *
 * **The end is where they differ.** Base64 fills its last group with zero bits
 * and pads the text with `=` to a multiple of four characters. CBase32 appends
 * a stop bit, `1`, then zeros, so a decoder can find where the data ends
 * without knowing its length — which is why empty text still encodes to `g`,
 * the stop bit alone. Fill bits are shown after a `·`.
 *
 * **The groups are drawn here, the characters are the codecs' own.** Each
 * character under a group is read from what `base64/encode` and
 * `cbase32/vecToCBase32` return, never computed by the demo, so a demo that
 * drew the groups wrong would show a mismatch rather than agree with itself.
 * The Base64 line can be checked from outside: `printf '%s' 'hé' | base64`
 * prints `aMOp`. CBase32 is this repository's own, so its groups are what
 * make it checkable by hand.
 *
 * **Text UTF-8 cannot encode is refused**: a JavaScript string can hold half
 * a surrogate pair, which has no UTF-8 bytes to encode (see `text/utf8`).
 *
 * **It needs no operations.** Encoding is a pure function of the input, so
 * `update` declares `never` and returns its next state through `pureOk`.
 *
 * @module
 *
 * @import { Demo, DemoEvent } from '../website/demo/types.ts'
 * @import { Element, Node } from '../media/html/types.ts'
 * @import { Nullable } from '../types/nullable/types.ts'
 * @import { _Encoding, _Encodings, _Scheme } from './private.ts'
 */

import { encode as base64 } from './base64/module.f.mjs'
import { vecToCBase32 } from './cbase32/module.f.mjs'
import { fromCodePointList } from '../text/utf8/module.f.mjs'
import { stringToCodePointList } from '../text/utf16/module.f.mjs'
import { isValidCodePoint } from '../text/code_point/module.f.mjs'
import { u8ListToVecMsb } from '../types/bit_vec/module.f.mjs'
import { toArray } from '../types/list/module.f.mjs'
import { assertNotNullish } from '../asserts/module.f.mjs'
import { textDemo } from '../website/demo/module.f.mjs'

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
 * Base64: six bits a character; a short last group is filled with zeros, and
 * whole groups need nothing.
 *
 * @type {_Scheme}
 */
const base64Scheme = {
    width: 6,
    count: n => Math.ceil(n / 6),
    fill: k => '0'.repeat(k),
}

/**
 * CBase32: five bits a character, and there is always a stop bit — so always
 * one more group than the whole ones, even when the data fills them exactly.
 *
 * @type {_Scheme}
 */
const cBase32Scheme = {
    width: 5,
    count: n => Math.floor(n / 5) + 1,
    fill: k => `1${'0'.repeat(k - 1)}`,
}

/**
 * The groups `scheme` cuts `b` into, each as its bits, with any fill bits after
 * a `·`.
 *
 * @type {(scheme: _Scheme) => (b: string) => readonly string[]}
 */
const groups = ({ width, count, fill }) => b =>
    Array.from({ length: count(b.length) }, (_, i) => {
        const data = b.slice(i * width, (i + 1) * width)
        return data.length === width ? data : `${data}·${fill(width - data.length)}`
    })

/**
 * One encoding of the text: the groups its bits are cut into, and what the
 * codec wrote for them, one character per group plus any `=` padding.
 *
 * @type {(scheme: _Scheme, b: string, encoded: string) => _Encoding}
 */
const encoding = (scheme, b, encoded) => ({ groups: groups(scheme)(b), encoded })

/**
 * What the demo shows for `text`: its UTF-8 bytes in binary, then its Base64
 * and CBase32 encodings — or why there are none.
 *
 * @type {(text: string) => _Encodings | string}
 */
export const encodings = text => {
    const bytes = utf8Bytes(text)
    if (bytes === null) { return 'error: unpaired surrogate, no UTF-8' }
    const v = u8ListToVecMsb(bytes)
    const binary = bytes.map(x => x.toString(2).padStart(8, '0'))
    const b = binary.join('')
    return {
        bytes: binary,
        base64: encoding(base64Scheme, b, assertNotNullish(base64(v), 'UTF-8 is whole bytes')),
        cBase32: encoding(cBase32Scheme, b, vecToCBase32(v)),
    }
}

/** Groups per row: four Base64 groups are three bytes, one whole quantum. */
const perRow = 4

/**
 * A table of an encoding's groups, four to a row: each group's bits, and under
 * them, in a header cell, the character the codec wrote for it. The header
 * cell is what sets the characters apart from the bits: a browser bolds and
 * centres it, and the site sets everything in one monospace face, so nothing
 * else would.
 *
 * @type {(e: _Encoding) => Element}
 */
const table = ({ groups, encoded }) => {
    /** @type {(tag: string) => (text: string) => Element} */
    const cell = tag => text => [tag, text]
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
 * One encoding's part of the page: its name in bold and how it cuts the bits,
 * the table, then the whole result in bold.
 *
 * @type {(name: string, how: string) => (e: _Encoding) => readonly Node[]}
 */
const section = (name, how) => e => [
    ['p', ['strong', name], ` — ${how}`],
    ...(e.groups.length === 0 ? [] : [table(e)]),
    ['p', 'Result: ', ['strong', orEmpty(e.encoded)]],
]

/**
 * The state is the text itself, not its encodings: they are a function of it,
 * and storing a value the state can already compute is how the two drift
 * apart.
 *
 * The initial text is three bytes, one whole Base64 quantum, so Base64 needs
 * no fill and CBase32 ends on a stop bit after four data bits. Typing `h`
 * shows the opposite case.
 *
 * @type {Demo<string, DemoEvent>}
 */
export const demo = textDemo({
    name: 'text',
    label: 'Text',
    rows: 2,
    init: 'hé',
})(text => {
    const e = encodings(text)
    return typeof e === 'string' ? [['p', ['strong', e]]] : [
        ['p', ['strong', 'UTF-8 bytes'], ' — binary'],
        ['pre', orEmpty(e.bytes.join(' '))],
        ...section('Base64', '6 bits per character; fill bits after ·')(e.base64),
        ...section('CBase32', '5 bits per character, then a stop bit; fill bits after ·')(e.cBase32),
    ]
})
