/**
 * Result and deferred operand types for stateless EDAG value control flow.
 *
 * @module
 */

import type { EdagValue } from '../types.ts'
import type { Result } from '../../../types/result/types.ts'

export type ValueResult = Result<EdagValue, EdagValue>

/** An operand evaluated only when the operation demands it. */
export type ValueThunk = () => ValueResult
