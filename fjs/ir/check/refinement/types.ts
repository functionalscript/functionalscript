/**
 * Lattice ranges for comparison-narrowing
 * ([comparison-refinement.md](../../../../doc/sasha-gil/ir/comparison-refinement.md)).
 *
 * @module
 */

import type { Int } from '../../types.ts'

/**
 * An integer range or bottom: `null` is `⊥` (unreachable / empty).
 * Named widths are ordinary `Int` intervals.
 */
export type Range = Int | null

/** Comparison operators that refine integer locals. */
export type CompareOp = 'lt' | 'le' | 'eq'
