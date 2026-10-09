/**
 * Type of the enumerable own-property reader.
 *
 * @module
 */

import type { Assert } from '../../../asserts/types.ts'
import type { Equal } from '../../ts/types.ts'
import type { entry } from './module.f.js'

/**
 * Known keys preserve their value type, with undefined when the property is
 * absent, inherited, or non-enumerable. Arbitrary receivers and converted keys
 * return unknown.
 */
export type EntryLookup = {
    <T extends object, K extends keyof T>(a: T, b: K): T[K] | undefined
    (a: unknown, b: any): unknown
}

// Array length is statically a number but is not an enumerable entry.
type _ArrayLengthMayBeAbsent = Assert<Equal<
    ReturnType<typeof entry<readonly number[], 'length'>>,
    number | undefined
>>

type _RecordFieldMayBeAbsent = Assert<Equal<
    ReturnType<typeof entry<{ readonly a: number }, 'a'>>,
    number | undefined
>>
