/**
 * Type-level API for `fjs/media/note/module.f.mjs`: `Note` and `NoteError`.
 */

import type { ValidationError } from '../../types/rtti/common/types.ts'
import type { Ts } from '../../types/rtti/ts/types.ts'
import type { noteSchema } from './module.f.mjs'

/** The TypeScript type derived from `noteSchema` — the single source of truth. */
export type Note = Ts<typeof noteSchema>

/** Either a structural validation error or a JSON parse error message. */
export type NoteError = ValidationError | string
