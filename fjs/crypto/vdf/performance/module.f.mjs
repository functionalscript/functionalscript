/**
 * Calculations for the demo's measured millisecond durations. A conservative
 * 1 ms floor suppresses ratios for readings too close to clock quantization;
 * these educational measurements are not security benchmarks.
 *
 * @module
 */

/** A finite, non-negative clock interval.
 * @type {(duration: number) => boolean}
 */
export const validDuration = duration => Number.isFinite(duration) && duration >= 0

/** Median of measured calls, or null for missing/invalid samples.
 * @type {(samples: readonly number[]) => number | null}
 */
export const median = samples => {
    if (samples.length === 0 || !samples.every(validDuration)) { return null }
    const sorted = samples.toSorted((a, b) => a - b)
    const middle = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
}

/** Work / verification, only for reliably measurable intervals.
 * @type {(work: number, verification: number) => number | null}
 */
export const ratio = (work, verification) =>
    !validDuration(work) || !validDuration(verification) || work < 1 || verification < 1
        ? null : work / verification

/** Units and precision appropriate to a measured duration.
 * @type {(duration: number) => string}
 */
export const formatDuration = duration => duration < 0.01 ? '<0.01 ms'
    : duration < 1_000 ? `${duration.toFixed(2)} ms` : `${(duration / 1_000).toFixed(2)} s`
