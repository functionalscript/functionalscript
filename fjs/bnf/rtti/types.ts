import type { Assert } from "../../asserts/types.ts"
import type { digit } from "../lib/json/module.f.mjs"
import type { Equal } from "../../types/ts/types.ts"
import type { Join1Plus, Repeat0Plus, Repeat1Plus, Rule, TerminalRange } from "../types.ts"

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
    R extends Repeat0Plus<infer I> ? (() => _FromAny<I>) :
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

type _X = Repeat0Plus<0>
type _4 = Assert<Equal<AstRule<_X>, () => number>>

// The same shape written out by hand, not through the alias: structural, so it
// must match too.
type _Inline = () => {
    readonly some: readonly[0, _Inline],
    readonly none: readonly[]
}
type _5 = Assert<Equal<AstRule<_Inline>, () => number>>

// A repeat over a composite item.
type _6 = Assert<Equal<
    AstRule<Repeat0Plus<readonly[0, 1]>>,
    () => readonly[number, number]>>

// A lazy rule that is an ordinary variant must NOT be read as a repeat.
type _Lazy = () => { readonly a: 0, readonly b: 1 }
type _7 = Assert<Equal<
    AstRule<_Lazy>,
    { readonly a: number, readonly b: number }>>

// The discriminator: `some`/`none` present, but the tail is not the rule
// itself, so it is a variant rather than a repeat.
type _NotRepeat = () => {
    readonly some: readonly[0, 1],
    readonly none: readonly[]
}
type _8 = Assert<Equal<
    AstRule<_NotRepeat>,
    { readonly some: readonly[number, number], readonly none: readonly[] }>>

// The derived combinators, which are `Repeat0Plus` in a larger shape.
type _9 = Assert<Equal<
    AstRule<Repeat1Plus<0>>,
    readonly[number, () => number]>>
type _10 = Assert<Equal<
    AstRule<Join1Plus<0, 1>>,
    readonly[number, () => readonly[number, number]]>>

// A repeat over a real grammar rule: `digit = range('09')` in `../lib/json`.
type _11 = Assert<Equal<AstRule<Repeat0Plus<typeof digit>>, () => number>>
