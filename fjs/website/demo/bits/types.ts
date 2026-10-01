/**
 * Type-level API for `fjs/website/demo/bits/module.f.mjs`: a demo that shows
 * a base-N codec cutting a text's UTF-8 bits into groups.
 *
 * @module
 */

import type { Vec } from '../../../types/bit_vec/types.ts'
import type { Node } from '../../../media/html/types.ts'

/**
 * How a codec cuts bits into groups: the group width, how many groups a
 * number of bits makes, and the fill bits that complete a short last group.
 */
export type BitScheme = {
    readonly width: number
    readonly count: (n: number) => number
    readonly fill: (k: number) => string
}

/**
 * What a bit-group demo shows for a text: its UTF-8 bytes in binary, the
 * groups its bits are cut into (each with any fill bits after a `·`), and the
 * codec's own output, one character per group plus any padding.
 */
export type BitGroups = {
    readonly bytes: readonly string[]
    readonly groups: readonly string[]
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
