/**
 * TypeScript type transformers for RTTI schemas.
 *
 * Each `*Ts` type maps a schema (or schema fragment) to its corresponding TypeScript type.
 * The main entry point is `Ts<T>`.
 *
 * The runtime `toTs` function mirrors `Ts<T>` at value level, returning a TypeScript
 * type expression string for a given RTTI schema.
 */
import { type Equal, primitive, union, printer as tsPrinter } from '../../ts/module.f.ts'
import type { Tag0, Tag1, Const, Or, String as RttiString, Struct, Tuple, Type, ConstObject } from '../module.f.ts'
import type { ReadonlyRecord } from '../../object/module.f.ts'
import type { Assert } from '../../../asserts/module.f.ts'
import { type Phantom, type phantomKey } from '../../phantom/module.f.ts'

/**
 * The set of primitive literal types representable as rtti `Const` values.
 * Defined here rather than imported from `djs` to keep rtti free of djs dependencies
 * (djs depends on rtti, not the other way around — see [i665-rtti-defines-types]).
 */
export type Primitive = null | boolean | number | string | undefined | bigint

type _Assert0 = Assert<Equal<Const, ConstObject | Primitive>>

/**
 * The TypeScript type that rtti's `unknown` schema validates — any value that
 * an rtti schema can represent: a primitive, an array, or an object.
 *
 * Currently equivalent to `djs.Unknown`, but defined here to keep `rtti` free
 * of `djs` dependencies. May be extended to include functions or other
 * non-JSON-primitives in the future.
 */
export type Unknown = Primitive | Array | Object

/** A read-only array of {@link Unknown} values. */
export type Array = readonly Unknown[]

/** A read-only record of {@link Unknown} values. */
export type Object = {
    readonly [k in string]: Unknown
}

/** Maps a `Tag0` to its TypeScript type. */
export type Info0Ts<T extends Tag0> =
    T extends 'boolean' ? boolean :
    T extends 'number' ? number :
    T extends 'string' ? string :
    T extends 'bigint' ? bigint :
    T extends 'unknown' ? Unknown :
    never

/** Maps a `Const` schema to its TypeScript type. */
export type ConstTs<T> =
    T extends readonly Type[] ? TupleTs<T> :
    T extends { readonly[k in string]: Type } ? StructTs<T> :
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

type OptionalFields<T extends Struct> = {
    readonly[K in keyof T as undefined extends Ts<T[K]> ? K : never]?: Ts<T[K]>
}
type RequiredFields<T extends Struct> = {
    readonly[K in keyof T as undefined extends Ts<T[K]> ? never : K]: Ts<T[K]>
}

/** Maps a struct schema to a readonly object of resolved types, with optional fields for schemas that include `undefined`. */
export type StructTs<T extends Struct> =
    (keyof OptionalFields<T> extends never ? unknown : OptionalFields<T>) &
    (keyof RequiredFields<T> extends never ? unknown : RequiredFields<T>)

/**
 * Attaches a phantom output type `Out` to a schema `S`.
 *
 * `Ts<WithOut<S, Out>>` short-circuits to `Out` via the `phantomKey` branch without
 * recursing through the schema body — solving TS2589 for recursive struct schemas
 * where `StructTs` would otherwise expand infinitely.
 */
export type WithOut<S, Out> = Phantom<S, Out>

/**
 * Converts a schema `Type` to its corresponding TypeScript type.
 *
 * - `Thunk` → evaluates the returned `Info` via `InfoTs`
 * - `Const` → resolves via `ConstTs` (primitives map to themselves; structs/tuples recurse)
 *
 * @example
 * ```ts
 * type A = Ts<typeof string>          // string
 * type B = Ts<4>                      // 4
 * type C = Ts<Array<typeof number>>   // readonly number[]
 * type D = Ts<{ x: typeof boolean }>  // { readonly x: boolean }
 * ```
 */
export type Ts<T extends Type> =
    // Fast-path: when T is `any` (unknown extends any), short-circuit to Unknown
    // to prevent distributive conditional types from expanding across all branches
    // and hitting TS2589 (type instantiation excessively deep).
    unknown extends T ? Unknown :
    // Phantom output: if the schema carries a phantomKey annotation (via WithOut), return
    // it directly — one indexed-access, no structural walk, no TS2589 for recursive schemas.
    T extends { readonly [phantomKey]?: infer O } ? Exclude<O, undefined> :
    T extends () => infer I ? (
        I extends readonly['const', infer C] ? ConstTs<C> :
        // Info0
        I extends readonly['boolean'] ? boolean :
        I extends readonly['number'] ? number :
        I extends readonly['string'] ? string :
        I extends readonly['bigint'] ? bigint :
        I extends readonly['unknown'] ? Unknown :
        // Info1
        I extends readonly['array', infer E extends Type] ? readonly Ts<E>[] :
        I extends readonly['record', infer E extends Type] ? { readonly[K in string]: Ts<E> } :
        // Or
        I extends readonly['or', ...infer A extends readonly Type[]] ? Ts<A[number]> :
        //
        never
    ) :
    ConstTs<T>

/**
 * Creates a printer that converts an RTTI schema `Type` to its TypeScript type expression as a string.
 *
 * Mirrors the compile-time `Ts<T>` mapped type at runtime.
 * Pass `true` to emit mutable (non-`readonly`) types.
 *
 * **Note:** recursive schemas (e.g. `const list = () => ['array', list] as const`)
 * will cause infinite recursion. Only acyclic schemas are supported.
 *
 * **Note:** the `unknown` schema produces the string `'unknown'` (TypeScript's built-in),
 * whereas `Ts<>` maps it to `DjsUnknown` from `djs/module.f.ts`.
 *
 * @example
 * ```ts
 * const toTs = printer()
 * toTs(boolean)                    // 'boolean'
 * toTs(array(number))              // 'readonly(number)[]'
 * toTs(record(string))             // '{readonly[k:string]:string}'
 * toTs(or(string, number))         // 'string|number'
 * toTs(42)                         // '42'
 * toTs('hello')                    // '"hello"'
 * toTs([boolean, number])          // 'readonly[boolean,number]'
 * toTs({ x: string })              // '{readonly"x":string}'
 *
 * const toTsMut = printer(true)
 * toTsMut(array(number))           // '(number)[]'
 * toTsMut(record(string))          // '{[k:string]:string}'
 * ```
 */
export const printer = (mut?: true): (rtti: Type) => string => {
    const { tuple, struct, array, record } = tsPrinter(mut)

    const constToTs = (rtti: Const): string =>
        typeof rtti !== 'object' || rtti === null ? primitive(rtti) :
        rtti instanceof Array ? tuple(rtti.map(toTs)) :
        struct(Object.entries(rtti).map(([k, v]) => [k, toTs(v)]))

    const toTs = (rtti: Type): string => {
        if (typeof rtti !== 'function') { return constToTs(rtti) }
        const [tag, ...rest] = rtti()
        switch (tag) {
            case 'const': return constToTs(rest[0] as Const)
            case 'array': return array(toTs(rest[0]))
            case 'record': return record(toTs(rest[0]))
            case 'or': return union(rest.map(toTs))
            default: return tag // tag0: 'boolean' | 'number' | 'string' | 'bigint' | 'unknown'
        }
    }

    return toTs
}

// Fast-path: Ts<any> resolves to Unknown without TS2589 overflow.
type _any = Assert<Equal<Ts<any>, Unknown>>

type _null = Assert<Equal<Ts<null>, null>>
type _undefined = Assert<Equal<Ts<undefined>, undefined>>

type _true = Assert<Equal<Ts<true>, true>>
type _32 = Assert<Equal<Ts<32>, 32>>
type _42n = Assert<Equal<Ts<42n>, 42n>>
type _hello = Assert<Equal<Ts<'hello'>, 'hello'>>

type _tuple = Assert<Equal<Ts<readonly[12, true]>, readonly[12, true]>>
type _struct = Assert<Equal<
    Ts<{ readonly a: 'hello', readonly b: readonly[]}>,
    { readonly a: 'hello', readonly b: readonly[]}
>>
type _structOption = Assert<Equal<
    Ts<{ readonly a: RttiString, readonly b: Or<readonly[RttiString, undefined]> }>,
    { readonly a: string } & { readonly b?: string | undefined }
>>

type _const = Assert<Equal<Ts<() => readonly['const', 12]>, 12>>

type _boolean = Assert<Equal<Ts<() => readonly['boolean']>, boolean>>
type _number = Assert<Equal<Ts<() => readonly['number']>, number>>
type _string = Assert<Equal<Ts<() => readonly['string']>, string>>
type _bigint = Assert<Equal<Ts<() => readonly['bigint']>, bigint>>

type _unknown = Assert<Equal<Ts<() => readonly['unknown']>, Unknown>>

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
