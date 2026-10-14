/**
 * Type-level API for `fjs/media/note/module.f.mjs`: `Note` and `NoteError`.
 */

import type { Assert } from '../../asserts/types.ts'
import type { ValidationError } from '../../rtti/common/types.ts'
import type { Ts } from '../../rtti/ts/types.ts'
import type { Rest, Type } from '../../rtti/types.ts'
import type { Equal } from '../../types/ts/types.ts'
import type { JsonDialect } from '../types.ts'
import type { decodeText, encodeText, mediaType, noteSchema, validate } from './module.f.mjs'

/** The TypeScript type derived from `noteSchema` — the single source of truth. */
export type Note = Ts<typeof noteSchema>

/** Either a structural validation error or a JSON parse error message. */
export type NoteError = ValidationError | string

/**
 * `JsonDialect` at `noteSchema`'s container: the type `jsonDialect` gives the
 * module's kit. With no refinement, `E` is the factory's `never` default.
 *
 * The module writes each re-exported member's type out, so its declarations
 * stay what they were; assigning the kit's member to that annotation fails
 * if the call inferred a wider value type, and the pins below hold each
 * annotation to exactly the kit's member. The media type is not annotated,
 * so its pin is on the literal the kit itself derives. An error type left
 * uninferred would be `any` at this JavaScript call site and pass the
 * annotation; the `never` default that prevents it is pinned at a call in
 * `../proof.f.mjs` (`_NoRefinementError`).
 */
type _Kit = JsonDialect<typeof noteSchema extends Rest<infer S, Type> ? S : never>

type _MediaType = Assert<Equal<typeof mediaType, 'application/vnd.fjs.note+json'>>
type _EncodeText = Assert<Equal<typeof encodeText, _Kit['encodeText']>>
type _Validate = Assert<Equal<typeof validate, _Kit['validate']>>
type _DecodeText = Assert<Equal<typeof decodeText, _Kit['decodeText']>>
