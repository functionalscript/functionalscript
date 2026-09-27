/**
 * Implementation-private types for `./module.f.mjs`.
 *
 * @module
 */

/**
 * How much room a piece of track takes: its `width` along the track, and
 * how far it reaches `up` above the track and `down` below it.
 */
export type _Size = {
    readonly width: number
    readonly up: number
    readonly down: number
}
