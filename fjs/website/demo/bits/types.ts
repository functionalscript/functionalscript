/**
 * Type-level API for `fjs/website/demo/bits/module.f.mjs`: a demo that shows
 * a base-N codec cutting a text's UTF-8 bits into groups.
 *
 * @module
 */

import type { Vec } from '../../../types/bit_vec/types.ts'

/**
 * How a codec cuts bits into groups: the group width, and whether the data
 * ends with a stop bit. Without one, a short last group is filled with zeros
 * and whole groups need nothing. With one, a `1` follows the data and zeros
 * complete its group — so there is always one group more than the whole ones,
 * even when the data fills them exactly.
 *
 * `block` is the number of characters the codec works in, if it has such a
 * unit — Base64's four, which encode three bytes and which `=` completes. The
 * demo keeps a block whole on a line. A codec without one leaves it out, and
 * its groups wrap anywhere.
 */
export type BitScheme = {
    readonly width: number
    readonly stop: boolean
    readonly block?: number | undefined
}

/**
 * One group: the data bits it carries, then the stop bit (`'1'`, or `''` for
 * none), then the zero bits that fill it to the scheme's width.
 */
export type BitGroup = {
    readonly data: string
    readonly stop: string
    readonly fill: string
}

/**
 * One character of the text and its UTF-8 bytes in binary. `label` is the
 * character itself, or, for one a reader could not see — a space, a tab, a
 * line break, another control character — a visible stand-in, and then
 * `standIn` is `true`.
 */
export type ByteChar = {
    readonly label: string
    readonly standIn: boolean
    readonly bytes: readonly string[]
}

/**
 * What a bit-group demo shows for a text: its characters with their UTF-8
 * bytes, the groups those bits are cut into, and the codec's own output, one
 * character per group plus any padding.
 */
export type BitGroups = {
    readonly chars: readonly ByteChar[]
    readonly groups: readonly BitGroup[]
    readonly encoded: string
}

/**
 * What `bitGroupDemo` needs: its introductory paragraph, the codec's name,
 * a line on how it cuts the bits, its scheme, and its encoder.
 */
export type BitGroupDemoOptions = {
    /** What the codec does and how to read its groups. */
    readonly intro: string
    readonly name: string
    readonly how: string
    readonly scheme: BitScheme
    readonly encode: (v: Vec) => string
}
