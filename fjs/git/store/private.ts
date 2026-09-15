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

/**
 * Why an `objects/info/alternates` cannot be read: its bytes are not UTF-8, or a
 * line has text after its closing quote and so names a path only an off-by-one
 * in Git's own reader would build.
 *
 * An object rather than a tagged array, so it is told from a list of paths by
 * shape: a path may be any string, so no array of strings could stand for one of
 * these without a path being able to impersonate it.
 */
export type _Refusal = {
    readonly why: 'encoding' | 'line'
    readonly line: string
}
