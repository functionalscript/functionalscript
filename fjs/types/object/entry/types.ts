/**
 * Type of the enumerable own-property reader.
 *
 * @module
 */

import type { Assert } from '../../../asserts/types.ts'
import type { Equal } from '../../ts/types.ts'
import type { entry, hasEntry } from './module.f.js'

/**
 * A known key keeps its value type, with `undefined` for a property that
 * is absent, inherited, or non-enumerable. Any other receiver or key,
 * converted as the helper converts it, gives an unknown value. One
 * signature, not two overloads, so that the helper's body is typed by it.
 */
export type EntryLookup = <T, K>(a: T, b: K) => (K extends keyof T ? T[K] : unknown) | undefined

/**
 * The members of the union `T` that declare the key `K`, required or
 * optional.
 */
export type Declaring<T, K extends PropertyKey> = T extends unknown ? (K extends keyof T ? T : never) : never

/**
 * `T` once it is known to hold the key `K`: the members of a union that
 * declare `K`, as JavaScript's `in` narrows them, or `T` with `K` added
 * where none does. A key that is no property key, which the helper
 * converts, leaves `T` as it is.
 */
export type WithEntry<T, K> =
    K extends PropertyKey
        ? [Declaring<T, K>] extends [never]
            ? T & { readonly [P in K]: unknown }
            : Declaring<T, K>
        : T

/**
 * The presence of the enumerable own property, `true` for one holding
 * `undefined`, which `entry` reads as none. A type guard, so that a union
 * told apart by which key it holds narrows as it does under `in`. The key
 * is any value, as the helper converts it, and `const`, so that a literal
 * key stays the literal the narrowing needs.
 */
export type HasEntry = <T, const K>(a: T, b: K) => a is WithEntry<T, K>

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

// The helper is the guard its type names.
type _HasEntryIsTheGuard = Assert<Equal<typeof hasEntry, HasEntry>>

type _Variant = { readonly call: number } | { readonly chain: string }

// A union told apart by a key narrows to the members that require it.
type _NarrowsUnion = Assert<Equal<WithEntry<_Variant, 'call'>, { readonly call: number }>>

// Where no member declares the key, the receiver gains it.
type _AddsKey = Assert<Equal<WithEntry<{ readonly a: number }, 'b'>, { readonly a: number } & { readonly b: unknown }>>

type _Optional = { readonly kind: 'a', readonly value: number } | { readonly kind: 'b', readonly value?: string }

// A member that declares the key as optional may hold it, so it stays.
type _KeepsOptional = Assert<Equal<WithEntry<_Optional, 'value'>, _Optional>>

// A key the helper converts, such as `true`, narrows nothing.
type _ConvertedKey = Assert<Equal<WithEntry<{ readonly true: number }, true>, { readonly true: number }>>
