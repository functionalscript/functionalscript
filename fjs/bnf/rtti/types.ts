import type { Assert } from "../../asserts/types.ts"
import type { Equal } from "../../types/ts/types.ts"
import type { Rule, TerminalRange } from "../types.ts"

export type Ast =
    // terminal
    number |
    // sequence
    readonly Ast[] |
    // repeat
    (() => Ast) |
    // variant
    { readonly[k in string]: Ast}

type _FromAny<R> = R extends Rule ? AstRule<R> : never

export type AstRule<R extends Rule> =
    R extends () => {
        readonly some: readonly [infer I, R],
        readonly none: readonly[]
    } ? (() => _FromAny<I>) :
    R extends () => (infer U extends Rule) ? AstRule<U> :
    R extends TerminalRange ? number :
    R extends readonly Rule[] ? { readonly [K in keyof R]: _FromAny<R[K]> } :
    R extends string ? readonly number[] :
    R extends { readonly [K in string]: Rule } ? { readonly [K in keyof R]: _FromAny<R[K]> } :
    never

type _0 = Assert<Equal<AstRule<0>, number>>
type _1 = Assert<Equal<
    AstRule<readonly[0, 1]>,
    readonly[number, number]>>
type _2 = Assert<Equal<
    AstRule<readonly[0, 1, 2]>,
    readonly[number, number, number]>>
type _3 = Assert<Equal<
    AstRule<{ a: 0, b: 1 }>,
    { readonly a: number, readonly b: number }>>

/*
type _X = () => {
    readonly some: readonly[0, _X],
    readonly none: readonly[]
}
type _4 = Assert<Equal<_X, () => number>>
*/
