/**
 * Type-level API for `fjs/media/lock/module.f.mjs`: `Lock` and `LockError`.
 *
 * The map type itself is not restated here — it is `fjs/media/revision`'s
 * `LockMap`; import it from there directly rather than through this module.
 */

import type { Assert } from '../../asserts/types.ts'
import type { ValidationError } from '../../rtti/common/types.ts'
import type { Ts } from '../../rtti/ts/types.ts'
import type { Rest, Type } from '../../rtti/types.ts'
import type { Equal } from '../../types/ts/types.ts'
import type { JsonDialect } from '../types.ts'
import type { decodeText, encodeText, lockSchema, mediaType, validate } from './module.f.mjs'

/** The TypeScript type derived from `lockSchema` — the single source of truth. */
export type Lock = Ts<typeof lockSchema>

/** Either a structural validation error or a semantic (hash) error message. */
export type LockError = ValidationError | string

/**
 * `JsonDialect` at `lockSchema`'s container: the type `jsonDialect` gives
 * the module's kit. Its refinement, `checkReferences`,
 * raises `string`.
 *
 * The module writes each re-exported member's type out, so its declarations
 * stay what they were; assigning the kit's member to that annotation fails
 * if the call inferred a wider value or error type, and the pins below hold
 * each annotation to exactly the kit's member. The media type is not
 * annotated, so its pin is on the literal the kit itself derives.
 */
type _Kit = JsonDialect<typeof lockSchema extends Rest<infer S, Type> ? S : never, string>

type _MediaType = Assert<Equal<typeof mediaType, 'application/vnd.fjs.lock+json'>>
type _EncodeText = Assert<Equal<typeof encodeText, _Kit['encodeText']>>
type _Validate = Assert<Equal<typeof validate, _Kit['validate']>>
type _DecodeText = Assert<Equal<typeof decodeText, _Kit['decodeText']>>
