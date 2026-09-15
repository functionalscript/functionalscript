/**
 * Types private to the store's search over its object directories.
 *
 * @module
 */

import type { IoChannel } from '../../effects/types.ts'
import type { Nullable } from '../../types/nullable/types.ts'
import type { Result } from '../../types/result/types.ts'
import type { Envelope } from '../object/types.ts'

/**
 * What one object directory answered, and whether that answer is a *refusal*
 * rather than a miss.
 *
 * The two are told apart because a refusal outlives a miss: a borrowed store
 * whose pack cannot answer for an id it holds is corruption, and reporting the
 * repository's own `ENOENT` instead would answer "no such object" for a question
 * that was never answered. Only the loose read's own channel error is a miss —
 * the host saying there is no such file, which is what a store without the
 * object looks like. A hash mismatch is not: the file is there and holds
 * something else.
 */
export type _Outcome = readonly[Result<Nullable<Envelope>, IoChannel>, boolean]
