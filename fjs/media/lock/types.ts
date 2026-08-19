/**
 * Type-level API for `fjs/media/lock/module.f.mjs`: `Lock` and `LockError`.
 *
 * The map type itself is not restated here — it is `fjs/media/revision`'s
 * `LockMap`, re-exported so a consumer of the shared form needs only one
 * import, and so nothing can define a second, drifting spelling of it.
 */

import type { ValidationError } from '../../types/rtti/common/types.ts'
import type { Ts } from '../../types/rtti/ts/types.ts'
import type { lockSchema } from './module.f.mjs'

/** The TypeScript type derived from `lockSchema` — the single source of truth. */
export type Lock = Ts<typeof lockSchema>

/** Either a structural validation error or a semantic (hash) error message. */
export type LockError = ValidationError | string
