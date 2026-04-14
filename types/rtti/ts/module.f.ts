/**
 * TypeScript type transformers for RTTI schemas.
 *
 * Each `*Ts` type maps a schema (or schema fragment) to its corresponding TypeScript type.
 * The main entry point is `Ts<T>`.
 *
 * `toTsType` converts a runtime RTTI `Type` value to a `TsType` from `types/ts/module.f.ts`,
 * which can then be serialized to `.d.ts` content.
 */
import type { Equal, Assert, TsType } from '../../ts/module.f.ts'
import type { Unknown as DjsUnknown } from '../../../djs/module.f.ts'
import type {
    Tag0, Tag1,
    Const, Struct, Tuple,
    Info0, Info1, Type,
    Primitive0,
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
        // Or
        I extends readonly['or', ...infer A extends readonly Type[]] ? Ts<A[number]> :
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

type _orConst = Assert<Equal<
    Ts<() => readonly['or', false, 42, 'hello']>,
    false | 42 | 'hello'
>>

type _orStringNumber = Assert<Equal<
    Ts<() => readonly['or', 13, () => readonly['string']]>,
    13 | string
>>

type _SelfArray = readonly _SelfArray[]
type _SelfArrayType = () => readonly['array', _SelfArrayType]

type _selfArray = Assert<Equal<Ts<_SelfArrayType>, _SelfArray>>

/**
 * Converts a runtime RTTI `Type` value to a `TsType` for code generation.
 *
 * - Thunk schemas are evaluated and dispatched by tag.
 * - Const primitives map to `['literal', value]` (or `['null']`/`['undefined']`).
 * - Struct/tuple consts recurse into their fields/elements.
 */
export const toTsType = (type: Type): TsType => {
    if (typeof type === 'function') {
        const info = type()
        if (info[0] === 'const') { return constToTsType((info as readonly['const', Const])[1]) }
        if (info[0] === 'array') { return ['array', toTsType((info as readonly['array', Type])[1])] }
        if (info[0] === 'record') { return ['record', toTsType((info as readonly['record', Type])[1])] }
        if (info[0] === 'or') { return ['union', (info as readonly['or', ...readonly Type[]]).slice(1).map(toTsType)] }
        // Tag0: 'boolean' | 'number' | 'string' | 'bigint' | 'unknown'
        return [info[0] as Primitive0 | 'unknown'] as unknown as TsType
    }
    return constToTsType(type as Const)
}

const constToTsType = (c: Const): TsType => {
    if (c === null) { return ['null'] }
    if (c === undefined) { return ['undefined'] }
    if (Array.isArray(c)) { return ['tuple', (c as readonly Type[]).map(toTsType)] }
    if (typeof c === 'object') {
        return ['object', Object.entries(c).map(([k, v]) => [k, toTsType(v)] as const)]
    }
    return ['literal', c]
}
