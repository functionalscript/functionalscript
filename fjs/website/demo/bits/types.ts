/**
 * Type-level API for `fjs/website/demo/bits/module.f.mjs`: a demo that shows
 * a base-N codec cutting a text's UTF-8 bits into groups.
 *
 * @module
 */

import type { Vec } from '../../../types/bit_vec/types.ts'
import type { Node } from '../../../media/html/types.ts'

/**
 * How a codec cuts bits into groups: the group width, and whether the data
 * ends with a stop bit. Without one, a short last group is filled with zeros
 * and whole groups need nothing. With one, a `1` follows the data and zeros
 * complete its group — so there is always one group more than the whole ones,
 * even when the data fills them exactly.
 */
export type BitScheme = {
    readonly width: number
    readonly stop: boolean
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
 * What a bit-group demo shows for a text: its UTF-8 bytes in binary, the
 * groups its bits are cut into, and the codec's own output, one character per
 * group plus any padding.
 */
export type BitGroups = {
    readonly bytes: readonly string[]
    readonly groups: readonly BitGroup[]
    readonly encoded: string
}

/**
 * What `bitGroupDemo` needs: the codec's name and a line on how it cuts the
 * bits, its scheme, its encoder, and a note drawn after the result.
 */
export type BitGroupDemoOptions = {
    readonly name: string
    readonly how: string
    readonly scheme: BitScheme
    readonly encode: (v: Vec) => string
    readonly note: Node
}
