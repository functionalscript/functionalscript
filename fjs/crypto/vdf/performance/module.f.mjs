/**
 * Private linkage helpers for the demo's individual execution durations.
 *
 * @module
 */

import { formatDuration } from '../../../emergent_testing/module.f.mjs'

const durationText = formatDuration(2)

/** A finite, non-negative clock interval.
 * @type {(duration: number) => boolean}
 */
export const _validDuration = duration => Number.isFinite(duration) && duration >= 0

/** Units and precision appropriate to a measured duration.
 * @type {(duration: number) => string}
 */
export const _formatDuration = duration => duration < 0.01 ? '<0.01 ms'
    : durationText(duration)
