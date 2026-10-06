/**
 * Relational operations on evaluated primitives, returning boolean successes.
 * Two strings compare by UTF-16 code unit. Bigints compare exactly with
 * numbers and use integer parsing when compared with strings. NaN, tagged
 * undefined and invalid bigint/string comparisons succeed with false.
 *
 * Callers evaluate operands, propagate failures and convert containers or
 * functions to primitives in language order. Ordinary objects use the
 * number hint. This module consumes those primitive results.
 *
 * @module
 * @import { Primitive, EdagValue } from '../types.ts'
 * @import { Result } from '../../../types/result/types.ts'
 */

import { ok } from '../../../types/result/module.f.mjs'
import { primitiveToNumeric } from '../coercion/module.f.mjs'

/** Preserve strings for lexical and bigint/string comparisons. @param {Primitive} value */
const comparable = value => typeof value === 'string' ? value : primitiveToNumeric(value)

/** @type {(
 *  operator: (a: string | number | bigint, b: string | number | bigint) => boolean
 * ) => (a: Primitive, b: Primitive) => Result<boolean, EdagValue>} */
const relation = operator => (a, b) => ok(operator(comparable(a), comparable(b)))

/** @type {Readonly<Record<'<' | '<=' | '>' | '>=', (a: Primitive, b: Primitive) => Result<boolean, EdagValue>>>} */
export const binary = {
    '<': relation((a, b) => a < b),
    '<=': relation((a, b) => a <= b),
    '>': relation((a, b) => a > b),
    '>=': relation((a, b) => a >= b),
}
