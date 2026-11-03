/**
 * The publisher's own types.
 *
 * @module
 */

import type { Vec } from '../../../types/bit_vec/types.ts'
import type { Marked } from '../../../text/marked/types.ts'

/** The module as read, in its chunks, and each sample's WAT as `[sample, marked]`. */
export type _Checked = {
    readonly chunks: readonly Vec[]
    readonly wats: readonly (readonly [string, Marked])[]
}
