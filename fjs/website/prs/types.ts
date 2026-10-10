/**
 * The public GitHub response fields and labels the pull-request page reads.
 *
 * @module
 */

import type { Ts } from '../../rtti/ts/types.ts'
import type { checksSchema, pullsSchema, statusesSchema } from './module.f.mjs'

/** Open pull requests returned by GitHub, including draft pull requests. */
export type Pulls = Ts<typeof pullsSchema>

/** One pull request, with the head commit used to read its checks. */
export type Pull = Pulls[number]

/** One page of check runs for a pull request's head commit. */
export type Checks = Ts<typeof checksSchema>

/** A check run's execution state and, when completed, its conclusion. */
export type CheckRun = Checks['check_runs'][number]

/** One page of the current commit statuses for a pull request's head commit. */
export type Statuses = Ts<typeof statusesSchema>

/** A commit status reported by a CI provider. */
export type CommitStatus = Statuses['statuses'][number]

/** The combined outcome of the check runs and commit statuses that were read. */
export type CheckSummary = 'Passing' | 'Failing' | 'Pending' | 'No checks' | 'Unknown'

/** A summary, or the runtime's state while reading it. */
export type CheckLabel = CheckSummary | 'Loading' | 'Unavailable'
