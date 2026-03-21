/**
 * TypeScript type transformers for RTTI schemas.
 *
 * Each `*Ts` type maps a schema (or schema fragment) to its corresponding TypeScript type.
 * The main entry point is `Ts<T>`.
 */
import type { Equal, Assert } from '../../ts/module.f.ts'
import type { Primitive, Unknown as DjsUnknown } from '../../../djs/module.f.ts'
import type {
    Tag0, Tag1,
    Const, Struct, Tuple,
    Info0, Info1, Info, Type,
    String, Unknown,
    Array, Record,
} from '../module.f.ts'
import { string, unknown } from '../module.f.ts'
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
export type InfoTs<T extends Info> =
    T extends readonly['const', infer C extends Const] ? ConstTs<C> :
    T extends Info0<infer K extends Tag0> ? Info0Ts<K> :
    T extends Info1<infer K extends Tag1, infer I extends Type> ? Info1Ts<K, I> :
    never

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
        I extends readonly['const', infer C extends Const] ? ConstTs<C> :
        // Info0
        I extends readonly['boolean'] ? boolean :
        I extends readonly['number'] ? number :
        I extends readonly['string'] ? string :
        I extends readonly['bigint'] ? bigint :
        I extends readonly['unknown'] ? DjsUnknown :
        I extends Info0<infer K extends Tag0> ? Info0Ts<K> :
        I extends Info1<infer K extends Tag1, infer E extends Type> ? Info1Ts<K, E> :
        never) :
    ConstTs<T>

type _0 = Assert<Equal<
    Ts<readonly[
        number,
        4,
        String,
        null,
        'hello!',
        () => ['const', 7n],
        typeof unknown,
        Array<Unknown>,
        Record<12>,
        {
            readonly a: typeof string,
            b: bigint
        },
        () => ['const', readonly[String, 5n]]
    ]>,
    readonly[
        number,
        4,
        string,
        null,
        'hello!',
        7n,
        DjsUnknown,
        readonly DjsUnknown[],
        { readonly[K in string]: 12 },
        {
            readonly a: string,
            readonly b: bigint,
        },
        readonly[string, 5n],
    ]
>>

