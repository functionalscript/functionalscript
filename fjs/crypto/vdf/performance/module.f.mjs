/**
 * Validate and format the demo's individual execution durations.
 *
 * @module
 */

/** A finite, non-negative clock interval.
 * @type {(duration: number) => boolean}
 */
export const validDuration = duration => Number.isFinite(duration) && duration >= 0

/** Units and precision appropriate to a measured duration.
 * @type {(duration: number) => string}
 */
export const formatDuration = duration => duration < 0.01 ? '<0.01 ms'
    : duration < 1_000 ? `${duration.toFixed(2)} ms` : `${(duration / 1_000).toFixed(2)} s`
