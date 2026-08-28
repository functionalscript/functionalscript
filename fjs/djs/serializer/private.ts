/**
 * Implementation-private types for the DJS serializer.
 */

import type { List } from '../../types/list/types.ts'
import type { Unknown } from '../types.ts'

/**
 * A pre-hook consulted before each value's default serialization.
 * Returning a non-null list short-circuits the default path; this is how
 * `serializeWithConst` substitutes repeated values with `c<N>` references.
 */
export type _RefLookup = (value: Unknown) => List<string> | null

/**
 * How one output format spells a property key. The two formats disagree about
 * exactly one key, `__proto__`, so the spelling is a parameter of
 * `buildSerialize` rather than a property of the shared JSON helper.
 */
export type _KeySerialize = (key: string) => List<string>
