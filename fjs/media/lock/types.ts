/**
 * Type-level API for `fjs/media/lock/module.f.mjs`: `Lock` and `LockError`.
 *
 * The map type itself is not restated here — it is `fjs/media/revision`'s
 * `LockMap`; import it from there directly rather than through this module.
 */

import type { ValidationError } from '../../rtti/common/types.ts'
import type { Ts } from '../../rtti/ts/types.ts'
import type { lockSchema } from './module.f.mjs'

/** The TypeScript type derived from `lockSchema` — the single source of truth. */
export type Lock = Ts<typeof lockSchema>

/** Either a structural validation error or a semantic (hash) error message. */
export type LockError = ValidationError | string
