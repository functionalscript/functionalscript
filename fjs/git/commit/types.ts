/**
 * Type-level API of a commit.
 *
 * @module
 */

import type { Payload } from '../header/types.ts'

/**
 * A commit is its header list and its message, and nothing else: the
 * shape a tag has too, read by the same grammar. `tree`, `parent`,
 * `author` and `committer` are the headers Git reads by position,
 * `encoding`, `gpgsig` and `mergetag` the ones it reads by key, and the
 * functions of `./module.f.mjs` read them off the list.
 */
export type Commit = Payload
