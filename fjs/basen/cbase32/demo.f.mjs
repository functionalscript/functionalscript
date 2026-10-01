/**
 * CBase32 as you type: a text field, its UTF-8 bits, and the same bits cut
 * into five-bit groups, with the character `vecToCBase32` wrote for each
 * group under it.
 *
 * **CBase32 always ends with a stop bit.** After the data comes a `1`, then
 * zeros to complete the group, so a decoder finds where the data ends
 * without knowing its length. There is always one more group than the data
 * fills, so empty text is `g`: the stop bit alone, `10000`. The initial text,
 * `hé`, is 24 bits, which leaves four for the last group, then its stop bit:
 * `1001` and `1`.
 *
 * **There is no outside tool for it**: CBase32 is this repository's own
 * encoding, so the groups are what make its output checkable by hand.
 *
 * **It needs no operations.** Encoding is a pure function of the input, so
 * `update` declares `never` and returns its next state through `pureOk`.
 *
 * @module
 *
 * @import { BitScheme } from '../../website/demo/bits/types.ts'
 */

import { vecToCBase32 } from './module.f.mjs'
import { bitGroupDemo, bitGroups } from '../../website/demo/bits/module.f.mjs'

/**
 * Five bits a character, and a stop bit.
 *
 * @type {BitScheme}
 */
const scheme = { width: 5, stop: true }

/** What the demo shows for a text, for its proof. */
export const groupsOf = bitGroups(scheme, vecToCBase32)

export const demo = bitGroupDemo({
    name: 'CBase32',
    how: '5 bits per character, then a stop bit',
    scheme,
    encode: vecToCBase32,
    note: ['span', 'Base64 cuts the same bits into 6-bit groups: ', ['a', { href: '/fjs/basen/base64/' }, 'base64']],
})
