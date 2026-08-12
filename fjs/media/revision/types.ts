/**
 * Type-level API for `fjs/media/revision/module.f.mjs`: `LockMap`,
 * `Revision`, and `RevisionError`, derived from the module's own rtti
 * schemas.
 *
 * @module
 */

import type { Ts } from '../../types/rtti/ts/types.ts'
import type { ValidationError } from '../../types/rtti/common/types.ts'
import type { _lock, revisionSchema } from './module.f.mjs'

/** A flat set of subject-to-snapshot bindings supplied to dependency resolvers. */
export type LockMap = Ts<typeof _lock>

/** The TypeScript type derived from `revisionSchema` — the single source of truth. */
export type Revision = Ts<typeof revisionSchema>

/** Either a structural validation error or a semantic (hash / generation) error message. */
export type RevisionError = ValidationError | string
