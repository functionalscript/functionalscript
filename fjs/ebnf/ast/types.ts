import type { Assert } from "../../asserts/types.ts"
import type { Equal } from "../../types/ts/types.ts"
import type { Rule, Tuple, Variant } from "../types.ts"

export type Ast<R extends Rule> =
    // number
    R extends number ? R :
    // string
    R extends '' ? readonly[] :
    R extends string ? readonly number[] :
    // Tuple
    R extends Tuple ? _TupleAst<R> :
    // | Variant
    R extends Variant ? _VariantAst<R> :
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
