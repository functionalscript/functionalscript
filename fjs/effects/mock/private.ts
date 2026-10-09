/**
 * Proof-private operations for the mock runners.
 *
 * @module
 */

import type { OpResult } from '../types.ts'

/** Adds `n` to the state and answers the state it replaced. */
export type _Add = readonly['add', (n: number) => OpResult<number>]

/** An operation a partial runner declares without handling. */
export type _Sub = readonly['sub', (n: number) => OpResult<number>]
