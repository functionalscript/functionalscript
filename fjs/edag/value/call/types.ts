/**
 * Executor callbacks for represented bare-function calls.
 *
 * @module
 */

import type { Function as ValueFunction, Values, Array as ValueArray } from '../types.ts'
import type { ValueResult } from '../control/types.ts'

/** A bare call prepared and not yet made: the function with its fixed and rest bindings. */
export type Call = readonly ['call', ValueFunction, Values, ValueArray]

/**
 * What a body answers: its value, its throw, or the call in its tail
 * position, left for the executor to make in the invocation's place.
 */
export type Outcome = ValueResult | Call

/** Evaluate one body, given the original function and its bindings, to its outcome. */
export type Body = (fn: ValueFunction, fixed: Values, rest: ValueArray) => Outcome

/**
 * Start a fresh body invocation using the original function and its
 * bindings, and make every call the body leaves in its place, to a value.
 */
export type Invoke = (fn: ValueFunction, fixed: Values, rest: ValueArray) => ValueResult
