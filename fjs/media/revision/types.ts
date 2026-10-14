/**
 * Type-level API for `fjs/media/revision/module.f.mjs`: `LockMap`,
 * `LockSchema`, `LockField`, `LockFieldSchema`, `Revision`, `HashEntry`,
 * and `RevisionError`.
 *
 * `LockMap` is written by hand rather than derived, so that the recursion
 * reads directly, and is pinned against the module's rtti schema below — the
 * same hand-written-plus-pinned arrangement the JSON data model uses in
 * [`../json/types.ts`](../json/types.ts). `LockSchema` is
 * the schema side of the same recursion: `lock` cannot infer its own type
 * (a `const` may not reference itself in its own initializer), so it carries
 * this named annotation instead.
 *
 * @module
 */

import type { Assert } from '../../asserts/types.ts'
import type { ValidationError } from '../../rtti/common/types.ts'
import type { Check, Ts } from '../../rtti/ts/types.ts'
import type { Rest, String as RttiString, Type } from '../../rtti/types.ts'
import type { Equal } from '../../types/ts/types.ts'
import type { JsonDialect } from '../types.ts'
import type { decodeText, encodeText, lock, lockField, mediaType, revisionSchema, validate } from './module.f.mjs'

// The two pins below were `./proof.f.mjs`'s `consistency` entry, a body of
// nothing but typedefs — so neither bound to a statement and both were green
// whatever they claimed (`../../AGENTS.md` §1.4). Each sits beside the pair of
// types it holds together, where an alias is resolved on sight.

/**
 * A set of subject-to-snapshot bindings supplied to dependency resolvers.
 * A direct string value selects immutable content; a nested map scopes
 * further bindings under that subject (see the README).
 *
 * Spelled inline rather than as `StringMap<string | LockMap>`: a type alias
 * may not reference itself through another alias's instantiation (TS2456).
 */
export type LockMap = { readonly[subject in string]?: string | LockMap }

/** The rtti schema type of `lock` — a record of `string | LockSchema`. */
export type LockSchema =
    () => readonly['record', () => readonly['or', RttiString, LockSchema]]

type _LockMap = Assert<Check<LockMap, typeof lock>>

/**
 * A revision's `lock` field: the bindings inline as a {@link LockMap}, or the
 * cbase32 hash of a `vnd.fjs.lock` blob (`fjs/media/lock`) holding one to
 * share. Only the top level admits a hash — a string *inside* a map is a
 * dependency's content, unchanged.
 */
export type LockField = string | LockMap

/** The rtti schema type of `lockField` — a shared-lock reference or a lock map. */
export type LockFieldSchema =
    () => readonly['or', RttiString, LockSchema]

type _LockField = Assert<Check<LockField, typeof lockField>>

/** The TypeScript type derived from `revisionSchema` — the single source of truth. */
export type Revision = Ts<typeof revisionSchema>

/**
 * One hash-bearing field of a revision: the path that reaches it and the hash
 * it holds — `['parents', '0']`, `['snapshot']`, `['lock']` for a shared-lock
 * reference, `['lock', 'a', 'b']` for a value inside a lock map.
 */
export type HashEntry = readonly [readonly string[], string]

/** Either a structural validation error or a semantic (hash / generation) error message. */
export type RevisionError = ValidationError | string

/**
 * `JsonDialect` at `revisionSchema`'s container: the type `jsonDialect` gives
 * the module's kit. Its refinement, `checkReferences`,
 * raises `string`.
 *
 * The module writes each re-exported member's type out, so its declarations
 * stay what they were; assigning the kit's member to that annotation fails
 * if the call inferred a wider value or error type, and the pins below hold
 * each annotation to exactly the kit's member. The media type is not
 * annotated, so its pin is on the literal the kit itself derives.
 */
type _Kit = JsonDialect<typeof revisionSchema extends Rest<infer S, Type> ? S : never, string>

type _MediaType = Assert<Equal<typeof mediaType, 'application/vnd.fjs.revision+json'>>
type _EncodeText = Assert<Equal<typeof encodeText, _Kit['encodeText']>>
type _Validate = Assert<Equal<typeof validate, _Kit['validate']>>
type _DecodeText = Assert<Equal<typeof decodeText, _Kit['decodeText']>>
