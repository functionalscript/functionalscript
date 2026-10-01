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
 * @import { Node } from '../media/html/types.ts'
 * @import { Nullable } from '../types/nullable/types.ts'
 * @import { _Scheme } from './private.ts'
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

/** Groups per row: four Base64 groups are three bytes, one whole quantum. */
const perRow = 4

/**
 * Each group's bits, and under them the character the codec wrote for it, four
 * groups to a row.
 *
 * @type {(gs: readonly string[]) => (encoded: string) => string}
 */
const rows = gs => encoded =>
    Array.from({ length: Math.ceil(gs.length / perRow) }, (_, r) => {
        const row = gs.slice(r * perRow, (r + 1) * perRow)
        const chars = row.map((g, i) => encoded[r * perRow + i].padEnd(g.length))
        return `${row.join(' ')}\n${chars.join(' ').trimEnd()}`
    }).join('\n')

/**
 * One encoding's section: its groups with their characters, then the whole
 * encoded text.
 *
 * @type {(scheme: _Scheme, b: string, encoded: string) => string}
 */
const section = (scheme, b, encoded) => {
    const gs = groups(scheme)(b)
    return gs.length === 0 ? '(empty)' : `${rows(gs)(encoded)}\n= ${encoded}`
}

/**
 * What the demo shows for `text`: its UTF-8 bits, then its Base64 and CBase32
 * sections — or why there are none.
 *
 * @type {(text: string) => { readonly bits: string, readonly base64: string, readonly cBase32: string } | string}
 */
export const encodings = text => {
    const bytes = utf8Bytes(text)
    if (bytes === null) { return 'error: unpaired surrogate, no UTF-8' }
    const v = u8ListToVecMsb(bytes)
    const binary = bytes.map(x => x.toString(2).padStart(8, '0'))
    const b = binary.join('')
    return {
        bits: b === '' ? '(empty)' : binary.join(' '),
        base64: section(base64Scheme, b, assertNotNullish(base64(v), 'UTF-8 is whole bytes')),
        cBase32: section(cBase32Scheme, b, vecToCBase32(v)),
    }
}

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
    /** @type {readonly Node[]} */
    const view = typeof e === 'string' ? [['pre', e]] : [
        ['p', 'UTF-8 bytes, binary:'],
        ['pre', e.bits],
        ['p', 'Base64, 6 bits per character:'],
        ['pre', e.base64],
        ['p', 'CBase32, 5 bits per character, then a stop bit:'],
        ['pre', e.cBase32],
    ]
    return view
})
