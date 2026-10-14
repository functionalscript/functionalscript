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

/** Format a recorded interval without bounding unresolved elapsed time.
 * A zero reading may reflect browser clock quantization, whose resolution
 * varies. Intervals below the display precision therefore get words, not
 * an unsupported numeric upper bound.
 * @type {(duration: number) => string}
 */
export const _formatDuration = duration => duration < 0.01 ? 'too small to report reliably'
    : durationText(duration)
