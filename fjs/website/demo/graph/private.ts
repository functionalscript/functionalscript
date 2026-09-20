/**
 * Implementation-private types for `./module.f.mjs`.
 *
 * @module
 */

import type { Ranked } from './types.ts'

/** A {@link Ranked} node, placed — its own box. */
export type _Positioned = Ranked & {
    readonly x: number
    readonly y: number
    readonly width: number
    readonly height: number
}
