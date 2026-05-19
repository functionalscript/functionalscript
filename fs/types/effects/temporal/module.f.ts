/**
 * Temporal effect for reading the current instant.
 *
 * @module
 */
import { type Func, do_ } from '../module.f.ts'

export type Instant = Temporal.Instant

export type Now = readonly['now', () => Instant]

export const now: Func<Now> = do_('now')

export type TemporalOp = Now
