/**
 * Base64 as you type: a text field, its UTF-8 bits, and the same bits cut
 * into six-bit groups, with the character `encode` wrote for each group
 * under it.
 *
 * **Base64 works in blocks of four characters**, which encode three bytes
 * (RFC 4648 §4), so the demo keeps each block whole on a line. A short last
 * group is completed with zero fill bits, and `=` completes the last block:
 * `h` is `011010` and `00` filled with `0000`, so `aA==`. The initial text,
 * `hé`, is three bytes, one whole block, so it needs neither.
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
 * Six bits a character, and no stop bit: a short last group is filled with
 * zeros. Four characters are a block: they encode three bytes, and `=`
 * completes the last one.
 *
 * @type {BitScheme}
 */
const scheme = { width: 6, stop: false, block: 4 }

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
    how: '6 bits per character; every 4 characters encode 3 bytes, and = completes the last block',
    scheme,
    encode: encodeBytes,
    note: ['span', 'CBase32 cuts the same bits into 5-bit groups: ', ['a', { href: '/fjs/basen/cbase32/' }, 'cbase32']],
})
