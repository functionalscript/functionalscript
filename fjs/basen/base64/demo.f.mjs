/**
 * Base64 as you type: a text field, its UTF-8 bits, and the same bits cut
 * into six-bit groups, with the character `encode` wrote for each group
 * under it.
 *
 * **Base64 fills, then pads.** A short last group is completed with zero
 * bits, shown after a `·`, and the result is padded with `=` to a multiple
 * of four characters: `h` is `00·0000` and `aA==`. The initial text, `hé`,
 * is three bytes, which is four whole groups, so it needs neither.
 *
 * **The result can be checked from outside**: `printf '%s' 'hé' | base64`
 * prints `aMOp`.
 *
 * **It needs no operations.** Encoding is a pure function of the input, so
 * `update` declares `never` and returns its next state through `pureOk`.
 *
 * @module
 *
 * @import { BitScheme } from '../../website/demo/bits/types.ts'
 * @import { Vec } from '../../types/bit_vec/types.ts'
 */

import { encode } from './module.f.mjs'
import { assertNotNullish } from '../../asserts/module.f.mjs'
import { bitGroupDemo, bitGroups } from '../../website/demo/bits/module.f.mjs'

/**
 * Six bits a character; a short last group is filled with zeros, and whole
 * groups need nothing.
 *
 * @type {BitScheme}
 */
const scheme = {
    width: 6,
    count: n => Math.ceil(n / 6),
    fill: k => '0'.repeat(k),
}

/**
 * `encode`, for the only input the demo gives it: UTF-8 is whole bytes, so
 * the `null` that refuses anything else cannot come back.
 *
 * @type {(v: Vec) => string}
 */
const encodeBytes = v => assertNotNullish(encode(v), 'UTF-8 is whole bytes')

/** What the demo shows for a text, for its proof. */
export const groupsOf = bitGroups(scheme, encodeBytes)

export const demo = bitGroupDemo({
    name: 'Base64',
    how: '6 bits per character; a short last group is filled with zeros after ·, and = pads the result to a multiple of four',
    scheme,
    encode: encodeBytes,
    note: ['span', 'CBase32 cuts the same bits into 5-bit groups: ', ['a', { href: '/fjs/basen/cbase32/' }, 'cbase32']],
})
