/**
 * Type of the enumerable own-property reader.
 *
 * @module
 */

import type { Assert } from '../../../asserts/types.ts'
import type { Option } from '../../option/types.ts'
import type { Equal } from '../../ts/types.ts'
import type { entry } from './module.f.js'

/**
 * A known key keeps its value type inside the option, which is empty when
 * the property is absent, inherited, or non-enumerable. Any other receiver
 * or key, converted as the helper converts it, gives an option of an
 * unknown value. One signature, not two overloads, so that the helper's
 * body is typed by it: an overloaded type gives an arrow no contextual
 * return type, and `[x.value]` would widen to an array.
 */
export type EntryLookup = <T, K>(a: T, b: K) => Option<K extends keyof T ? T[K] : unknown>

/** The presence of the enumerable own property, the one bit the option carries. */
export type HasEntry = (a: unknown, b: any) => boolean

type _UnknownReceiver = Assert<Equal<
    ReturnType<typeof entry<unknown, string>>,
    Option<unknown>
>>

type _UnknownKey = Assert<Equal<
    ReturnType<typeof entry<{ readonly a: number }, 'b'>>,
    Option<unknown>
>>

// Array length is statically a number but is not an enumerable entry.
type _ArrayLengthMayBeAbsent = Assert<Equal<
    ReturnType<typeof entry<readonly number[], 'length'>>,
    Option<number>
>>

type _RecordFieldMayBeAbsent = Assert<Equal<
    ReturnType<typeof entry<{ readonly a: number }, 'a'>>,
    Option<number>
>>
