/**
 * Types for the Node.js memory-effect interpreter.
 */

import type { Effect, ToAsyncOperationMap } from '../../types.ts'
import type { Result } from '../../../types/result/types.ts'
import type { MemOp } from '../../memory/types.ts'

export type MemoryOperationMap = ToAsyncOperationMap<MemOp>

export type Uuid = () => string

/**
 * An `asyncRun` (`../../module.mjs`) runner over {@link MemOp}: an effect in,
 * its `Result` out.
 */
export type MemoryRun = <T, E>(effect: Effect<MemOp, T, E>) => Promise<Result<T, E>>
