/**
 * Temporal effect for reading the current instant as epoch nanoseconds.
 *
 * @module
 */
import { type Func, do_ } from '../module.f.ts'

export type Now = readonly['now', () => bigint]

export const now: Func<Now> = do_('now')

export type TemporalOp = Now
