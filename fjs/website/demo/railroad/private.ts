/**
 * Implementation-private types for `./module.f.js`.
 *
 * @module
 */

import type { Diagram } from './types.ts'
import type { Element } from '../../../media/html/types.ts'

/** Draw a piece in either direction, preserving its track position. */
export type _Draw = (backward: boolean) => (d: Diagram) => (x: number, y: number) => readonly Element[]

/**
 * How much room a piece of track takes: its `width` along the track, and
 * how far it reaches `up` above the track and `down` below it.
 */
export type _Size = {
    readonly width: number
    readonly up: number
    readonly down: number
}
