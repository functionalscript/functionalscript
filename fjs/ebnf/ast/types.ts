import type { Assert } from "../../asserts/types.ts"
import type { BoundedArray } from "../../types/array/types.ts"
import type { Equal } from "../../types/ts/types.ts"
import type { Const, Rule, Tuple, Variant, Set, Repeat } from "../types.ts"

export type Ast<R extends Rule> =
    // number
    R extends number ? R :
    // string
    R extends '' ? readonly[] :
    R extends string ? readonly number[] :
    // Tuple
    R extends Tuple ? _TupleAst<R> :
    // Variant
    R extends Variant ? _VariantAst<R> :
    // Const
    R extends Const<infer D> ? Ast<D> :
    // Set
    R extends () => ['set'] ? never :
    R extends Set ? number :
    // Repeat
    R extends Repeat<infer Min, infer Max, infer D> ? _RepeatAst<Min, Max, D>:
    //
    never

type _Number = Assert<Equal<Ast<number>, number>>
type _Number0 = Assert<Equal<Ast<42>, 42>>
type _Number1 = Assert<Equal<Ast<42|-1>, -1|42>>

type _String = Assert<Equal<Ast<string>, readonly number[]>>
type _String0 = Assert<Equal<Ast<'hello'>, readonly number[]>>
type _String1 = Assert<Equal<Ast<''>, readonly[]>>

type _TupleAst<R extends Tuple> = { readonly[K in keyof R]: Ast<R[K]> }

type _Tuple = Assert<Equal<Ast<[12, -1]>, readonly[12, -1]>>
type _Tuple0 = Assert<Equal<Ast<[]>, readonly[]>>
type _Tuple1 = Assert<Equal<Ast<[12, string]>, readonly[12, readonly number[]]>>

type _VariantAst<R extends Variant> = { readonly[K in keyof R]: Ast<R[K]> }

type _Variant = Assert<Equal<Ast<
    { readonly a: 12, readonly b: 'hello' }>,
    { readonly a: 12, readonly b: readonly number[] }>>
type _Variant0 = Assert<Equal<Ast<{}>, {}>>

type _Const = Assert<Equal<Ast<Const<42>>, 42>>
type _Const0 = Assert<Equal<Ast<() => ['const', 42]>, 42>>
type _Const1 = Assert<Equal<Ast<() => ['const', 'a']>, readonly number[]>>

type _Set = Assert<Equal<Ast<Set>, number>>
type _Set0 = Assert<Equal<Ast<() => ['set']>, never>>
type _Set1 = Assert<Equal<Ast<() => ['set', number]>, number>>
type _Set2 = Assert<Equal<Ast<() => ['set', number, -1]>, number>>

type _RepeatAst<Min extends number, Max extends number, D extends Rule> =
    BoundedArray<Min, Max, D>

type _Repeat = Assert<Equal<Ast<Repeat<0, 1, 43>>, readonly[] | readonly[43]>>
type _Repeat0 = Assert<Equal<Ast<Repeat<0, 0, 43>>, readonly[]>>
type _Repeat1 = Assert<Equal<Ast<Repeat<0, number, 43>>, readonly 43[]>>
type _Repeat2 = Assert<Equal<
    Ast<Repeat<2, number, 43>>,
    readonly[43, 43, ...readonly 43[]]>>
