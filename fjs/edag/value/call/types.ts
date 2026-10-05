/**
 * Executor callback for represented bare-function calls.
 *
 * @module
 */

import type { Function as ValueFunction, Values, Array as ValueArray } from '../types.ts'
import type { ValueResult } from '../control/types.ts'

/** Start a fresh body invocation using the original function and its bindings. */
export type Invoke = (fn: ValueFunction, fixed: Values, rest: ValueArray) => ValueResult
