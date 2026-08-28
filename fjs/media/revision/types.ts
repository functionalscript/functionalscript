/**
 * Type-level API for `fjs/media/revision/module.f.mjs`: `LockMap`,
 * `LockSchema`, `LockField`, `LockFieldSchema`, `Revision`, and
 * `RevisionError`.
 *
 * `LockMap` is written by hand rather than derived, so that the recursion
 * reads directly, and is then pinned against the module's rtti schema with
 * `Assert<Check<LockMap, typeof lock>>` — the same arrangement the JSON
 * data model uses in [`../json/types.ts`](../json/types.ts). `LockSchema` is
 * the schema side of the same recursion: `lock` cannot infer its own type
 * (a `const` may not reference itself in its own initializer), so it carries
 * this named annotation instead.
 */

import type { Assert } from '../../asserts/types.ts'
import type { Ts, Check } from '../../rtti/ts/types.ts'
import type { String as RttiString } from '../../rtti/types.ts'
import type { ValidationError } from '../../rtti/common/types.ts'
import type { lock, lockField, revisionSchema } from './module.f.mjs'

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

/** Either a structural validation error or a semantic (hash / generation) error message. */
export type RevisionError = ValidationError | string
