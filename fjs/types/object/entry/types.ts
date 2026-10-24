/**
 * Type of the enumerable own-property reader.
 *
 * @module
 */

import type { Assert } from '../../../asserts/types.ts'
import type { Equal } from '../../ts/types.ts'
import type { entry } from './module.f.js'

/**
 * A known key keeps its value type, with `undefined` for a property that
 * is absent, inherited, or non-enumerable. Any other receiver or key,
 * converted as the helper converts it, gives an unknown value. One
 * signature, not two overloads, so that the helper's body is typed by it.
 */
export type EntryLookup = <T, K>(a: T, b: K) => (K extends keyof T ? T[K] : unknown) | undefined

/** The presence of the enumerable own property, `true` for one holding `undefined`, which `entry` reads as none. */
export type HasEntry = (a: unknown, b: any) => boolean

type _UnknownReceiver = Assert<Equal<
    ReturnType<typeof entry<unknown, string>>,
    unknown
>>

type _UnknownKey = Assert<Equal<
    ReturnType<typeof entry<{ readonly a: number }, 'b'>>,
    unknown
>>

// Array length is statically a number but is not an enumerable entry.
type _ArrayLengthMayBeAbsent = Assert<Equal<
    ReturnType<typeof entry<readonly number[], 'length'>>,
    number | undefined
>>

type _RecordFieldMayBeAbsent = Assert<Equal<
    ReturnType<typeof entry<{ readonly a: number }, 'a'>>,
    number | undefined
>>
