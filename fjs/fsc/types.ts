/**
 * Types for the FunctionalScript compile-workflow state machine.
 *
 * @module
 */

import type { RangeMapArray } from '../types/range_map/types.ts'

/** A step outcome: diagnostics so far, and the next code-point handler. */
export type _Result = readonly [readonly string[], _ToResult]

export type _ToResult = (codePoint: number) => _Result

export type _CreateToResult<T> = (state: T) => _ToResult

export type _State<T> = RangeMapArray<_CreateToResult<T>>
