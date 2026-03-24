/**
 * TypeScript type transformers for RTTI schemas.
 *
 * Each `*Ts` type maps a schema (or schema fragment) to its corresponding TypeScript type.
 * The main entry point is `Ts<T>`.
 */
import type { Equal, Assert } from '../../ts/module.f.ts'
import type { Unknown as DjsUnknown } from '../../../djs/module.f.ts'
import type {
    Tag0, Tag1,
    Const, Struct, Tuple,
    Info0, Info1, Type,
} from '../module.f.ts'
import type { ReadonlyRecord } from '../../object/module.f.ts'

/** Maps a `Tag0` to its TypeScript type. */
export type Info0Ts<T extends Tag0> =
    T extends 'boolean' ? boolean :
    T extends 'number' ? number :
    T extends 'string' ? string :
    T extends 'bigint' ? bigint :
    T extends 'unknown' ? DjsUnknown :
    never

/** Maps a `Const` schema to its TypeScript type. */
export type ConstTs<T> =
    T extends readonly Type[] ? TupleTs<T> :
    T extends { readonly[k in string]: Type } ? { readonly[K in keyof T]: Ts<T[K]> } :
    T

/** Maps a `Tag1` and inner type to its TypeScript type. */
export type Info1Ts<K extends Tag1, T extends Type> =
    K extends 'array' ? ArrayTs<T> :
    K extends 'record' ? RecordTs<T> :
    never

/** Maps an `Info` descriptor to its TypeScript type. */
/*
export type InfoTs<T extends Info> =
    T extends readonly['const', infer C extends Const] ? ConstTs<C> :
    T extends Info0<infer K extends Tag0> ? Info0Ts<K> :
    T extends Info1<infer K extends Tag1, infer I extends Type> ? Info1Ts<K, I> :
    never
*/

/** Maps an array schema `T` to `readonly Ts<T>[]`. */
export type ArrayTs<T extends Type> = ReadonlyArray<Ts<T>>

/** Maps a record schema `T` to `{ readonly[K in string]: Ts<T> }`. */
export type RecordTs<T extends Type> = ReadonlyRecord<string, Ts<T>>

/** Maps a tuple schema to a readonly tuple of resolved types. */
export type TupleTs<T extends Tuple> =
    // readonly[...{ readonly[K in keyof T]: Ts<T[K]> }, ...readonly Unknown[]]
    { readonly[K in keyof T]: Ts<T[K]> }

/** Maps a struct schema to a readonly object of resolved types. */
export type StructTs<T extends Struct> = { readonly[K in keyof T]: Ts<T[K]> }

/**
 * Converts a schema `Type` to its corresponding TypeScript type.
 *
 * - `Thunk` → evaluates the returned `Info` via `InfoTs`
 * - `Const` → resolves via `ConstTs` (primitives map to themselves; structs/tuples recurse)
 *
 * @example
 * ```ts
 * type A = Ts<typeof string>           // string
 * type B = Ts<4>                       // 4
 * type C = Ts<Array<typeof number>>    // readonly number[]
 * type D = Ts<{ x: typeof boolean }>  // { readonly x: boolean }
 * ```
 */
export type Ts<T extends Type> =
    T extends () => infer I ? (
        I extends readonly['const', infer C] ? ConstTs<C> :
        // Info0
        I extends readonly['boolean'] ? boolean :
        I extends readonly['number'] ? number :
        I extends readonly['string'] ? string :
        I extends readonly['bigint'] ? bigint :
        I extends readonly['unknown'] ? DjsUnknown :
        // Info1
        I extends readonly['array', infer E extends Type] ? readonly Ts<E>[] :
        I extends readonly['record', infer E extends Type] ? { readonly[K in string]: Ts<E> } :
        //
        never
    ) :
    ConstTs<T>

type _null = Assert<Equal<Ts<null>, null>>
type _undefined = Assert<Equal<Ts<undefined>, undefined>>

type _true = Assert<Equal<Ts<true>, true>>
type _32 = Assert<Equal<Ts<32>, 32>>
type _hello = Assert<Equal<Ts<'hello'>, 'hello'>>

type _tuple = Assert<Equal<Ts<readonly[12, true]>, readonly[12, true]>>
type _struct = Assert<Equal<
    Ts<{ readonly a: 'hello', readonly b: readonly[]}>,
    { readonly a: 'hello', readonly b: readonly[]}
>>

type _const = Assert<Equal<Ts<() => readonly['const', 12]>, 12>>

type _boolean = Assert<Equal<Ts<() => readonly['boolean']>, boolean>>
type _number = Assert<Equal<Ts<() => readonly['number']>, number>>
type _string = Assert<Equal<Ts<() => readonly['string']>, string>>
type _bigint = Assert<Equal<Ts<() => readonly['bigint']>, bigint>>

type _unknown = Assert<Equal<Ts<() => readonly['unknown']>, DjsUnknown>>

type _array = Assert<Equal<Ts<
    () => readonly['array', 12]>,
    readonly 12[]
>>
type _record = Assert<Equal<
    Ts<() => readonly['record', () => readonly['boolean']]>,
    { readonly[k in string]: boolean }
>>

type _tupleString = Assert<Equal<
    Ts<readonly[() => readonly['string']]>,
    readonly[string]
>>

type _SelfArray = readonly _SelfArray[]
type _SelfArrayType = () => readonly['array', _SelfArrayType]

type _selfArray = Assert<Equal<Ts<_SelfArrayType>, _SelfArray>>
