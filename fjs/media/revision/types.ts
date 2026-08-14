/**
 * Type-level API for `fjs/media/revision/module.f.mjs`: `LockMap`,
 * `LockSchema`, `Revision`, and `RevisionError`.
 *
 * `LockMap` is written by hand rather than derived, so that the recursion
 * reads directly, and is then pinned against the module's rtti schema with
 * `Assert<Equal<LockMap, Ts<typeof lock>>>` — the same arrangement the JSON
 * data model uses in [`../json/types.ts`](../json/types.ts). `LockSchema` is
 * the schema side of the same recursion: `lock` cannot infer its own type
 * (a `const` may not reference itself in its own initializer), so it carries
 * this named annotation instead.
 *
 * @module
 */

import type { Assert } from '../../asserts/types.ts'
import type { Equal } from '../../types/ts/types.ts'
import type { Ts } from '../../types/rtti/ts/types.ts'
import type { String as RttiString } from '../../types/rtti/types.ts'
import type { ValidationError } from '../../types/rtti/common/types.ts'
import type { lock, revisionSchema } from './module.f.mjs'

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

type _LockMap = Assert<Equal<LockMap, Ts<typeof lock>>>

/** The TypeScript type derived from `revisionSchema` — the single source of truth. */
export type Revision = Ts<typeof revisionSchema>

/** Either a structural validation error or a semantic (hash / generation) error message. */
export type RevisionError = ValidationError | string
