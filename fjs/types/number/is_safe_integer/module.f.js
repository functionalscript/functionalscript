/**
 * The safe-integer predicate: an integer within the exact integer range of a
 * JavaScript number. Non-numbers, fractions, infinities and NaN are refused;
 * both spellings of zero are accepted, as by `Number.isSafeInteger`.
 *
 * @module
 */

import { isInteger } from '../is_integer/module.f.js'

// Binary64 has 53 bits of integer precision: the inclusive bound is 2^53 - 1.
const maxSafeInteger = 0x1F_FFFF_FFFF_FFFF

/** @type {(value: number) => boolean} */
const isInSafeIntegerRange = value =>
    value >= -maxSafeInteger && value <= maxSafeInteger

/**
 * Whether `value` is an integer in the safe range, without converting it.
 *
 * @param {unknown} value
 * @returns {value is number}
 */
export const isSafeInteger = value =>
    typeof value === 'number' && isInteger(value) && isInSafeIntegerRange(value)
