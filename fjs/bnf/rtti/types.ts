/**
 * The AST a BNF rule parses into, derived from the rule itself.
 *
 * {@link AstRule} maps a {@link Rule} to the shape a match against it produces:
 * a terminal becomes a number, a sequence maps element-wise, a variant becomes
 * the union of its branches, and a repetition becomes an array. Everything here
 * is types and `Assert`s, so `tsc` is this module's test.
 *
 * @module
 */

import type { Assert } from "../../asserts/types.ts"
import type { digit, optionNeg, uint } from "../lib/json/module.f.mjs"
import type { Equal } from "../../types/ts/types.ts"
import type { Join1Plus, Repeat0Plus, Repeat1Plus, Rule, TerminalRange, Variant } from "../types.ts"

export type Ast =
    // terminal
    number |
    // sequence | repeat
    readonly Ast[] |
    // variant: the one branch that matched, under its own name
    { readonly[k in string]: Ast}

type _FromAny<R> = R extends Rule ? AstRule<R> : never

/**
 * The AST of a variant `R`: one branch per key of `K`, each naming only the
 * branch that matched. Called as `_Branches<R, keyof R>`.
 *
 * The keys are distributed over rather than mapped and indexed
 * (`{ [K in keyof R]: ... }[keyof R]`). Both describe the same union, but the
 * mapped form leaves each branch's `_FromAny<R[K]>` deferred behind a key the
 * compiler has not yet chosen, and a deferred branch is not *identical* to the
 * branch written out by hand even where the two are mutually assignable — so
 * {@link Equal} reads them as different and no assertion below could be
 * written. Distributing picks one key at a time, which resolves `R[K]`.
 *
 * `R[K]` of an optional key carries `undefined`, which `_FromAny` drops: a key
 * a grammar author wrote as optional still names a branch a match can select.
 */
type _Branches<R extends Variant, K> =
    K extends keyof R ? { readonly [_ in K & PropertyKey]: _FromAny<R[K]> } : never

export type AstRule<R extends Rule> =
    R extends Repeat0Plus<infer I extends Rule> ? readonly AstRule<I>[] :
    R extends () => (infer U extends Rule) ? AstRule<U> :
    R extends TerminalRange ? number : // this is something that would be good to change
    R extends readonly Rule[] ? { readonly [K in keyof R]: _FromAny<R[K]> } :
    R extends string ? readonly number[] :
    // A variant is a choice, so its AST is the union of what each branch
    // produces, never the product of all of them: a match selects exactly one,
    // the same contract `Branch` states in `../matcher/types.ts`.
    R extends Variant ? _Branches<R, keyof R> :
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
    { readonly a: number } | { readonly b: number }>>

type _X = Repeat0Plus<0>
type _4 = Assert<Equal<AstRule<_X>, readonly number[]>>

// The same shape written out by hand, not through the alias: structural, so it
// must match too.
type _Inline = () => {
    readonly some: readonly[0, _Inline],
    readonly none: readonly[]
}
type _5 = Assert<Equal<AstRule<_Inline>, readonly number[]>>

// A repeat over a composite item.
type _6 = Assert<Equal<
    AstRule<Repeat0Plus<readonly[0, 1]>>,
    readonly (readonly[number, number])[]>>

// A lazy rule that is an ordinary variant must NOT be read as a repeat.
type _Lazy = () => { readonly a: 0, readonly b: 1 }
type _7 = Assert<Equal<
    AstRule<_Lazy>,
    { readonly a: number } | { readonly b: number }>>

// The discriminator: `some`/`none` present, but the tail is not the rule
// itself, so it is a variant rather than a repeat.
type _NotRepeat = () => {
    readonly some: readonly[0, 1],
    readonly none: readonly[]
}
type _8 = Assert<Equal<
    AstRule<_NotRepeat>,
    { readonly some: readonly[number, number] } | { readonly none: readonly[] }>>

// The derived combinators, which are `Repeat0Plus` in a larger shape.
type _9 = Assert<Equal<
    AstRule<Repeat1Plus<0>>,
    readonly[number, readonly number[]]>>
type _10 = Assert<Equal<
    AstRule<Join1Plus<0, 1>>,
    readonly[number, readonly (readonly[number, number])[]]>>

// A repeat over a real grammar rule: `digit = range('09')` in `../lib/json`.
type _11 = Assert<Equal<AstRule<Repeat0Plus<typeof digit>>, readonly number[]>>

// A variant written with optional keys — the shape `Variant` itself declares —
// names the same branches. Optionality says which branches a grammar author
// wrote down, not which of them a match may leave out.
type _12 = Assert<Equal<
    AstRule<{ readonly a?: 0, readonly b?: 1 }>,
    { readonly a: number } | { readonly b: number }>>

// A real grammar variant: `uint` in `../lib/json` is `'0' | onenine digits0`,
// and a match is one of the two, never both.
type _13 = Assert<Equal<
    AstRule<typeof uint>,
    { readonly 0: readonly number[] }
    | { readonly onenine: readonly[number, readonly number[]] }>>

// An option is a variant like any other, so a match takes the branch it took.
type _14 = Assert<Equal<
    AstRule<typeof optionNeg>,
    { readonly some: readonly number[] } | { readonly none: readonly[] }>>
