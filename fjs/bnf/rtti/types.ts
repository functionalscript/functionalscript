/**
 * The AST a BNF rule parses into, derived from the rule itself.
 *
 * {@link AstRule} maps a {@link Rule} to the shape a match against it produces:
 * a terminal becomes a number, a sequence maps element-wise, a variant becomes
 * the union of its branches, and a repetition becomes an array. Everything here
 * is types and `Assert`s, so `tsc` is this module's test.
 *
 * A rule the parser cannot process at all resolves to `never` rather than to a
 * plausible shape: a branch whose declared type admits `undefined` makes
 * `toData` throw, and is refused here.
 *
 * A repetition is recognized from the rule alone, which is short of what
 * `repeatOf` in `../data/module.f.mjs` asks: that module also refuses an item
 * that can match empty or that can reach the repetition again, and it asks
 * whether the tail *is* this rule by name where the test below can only ask
 * whether it has this rule's shape. Each is a question about a rule *set*
 * rather than a rule, and the last is beyond reach rather than merely
 * unasked — two rules of the same shape are the same type here, so nothing
 * written against the type can separate them. These are the only places this
 * module and the parser disagree:
 * [nullable-repeat-item](./todo/nullable-repeat-item.md).
 *
 * @module
 */

import type { Assert } from "../../asserts/types.ts"
import type {
    array as jsonArray, digit, optionNeg, string as jsonString, uint,
} from "../lib/json/module.f.mjs"
import type { Equal } from "../../types/ts/types.ts"
import type {
    DataRule, Join1Plus, Repeat0Plus, Repeat1Plus, Rule, Sequence, TerminalRange,
    Variant,
} from "../types.ts"

export type Ast =
    // terminal
    number |
    // sequence | repeat
    readonly Ast[] |
    // variant: the one branch that matched, under its own name
    { readonly[k in string]: Ast}

type _FromAny<R> = R extends Rule ? AstRule<R> : never

/** `never` for a union of two or more, so this asks for exactly one member. */
type _Single<T> =
    [T] extends [never]
        ? false
        : Equal<(T extends unknown ? (x: T) => void : never) extends
            (x: infer I) => void ? I : never, T>

/**
 * A rule with any lazy wrapper taken off. Recognition in
 * `../data/module.f.mjs` runs over the *normalized* rules, where a lazy alias
 * in either branch means what its direct form means, so a branch written
 * `() => readonly []` has to be read as the empty sequence it stands for.
 */
type _Data<R> = R extends () => infer U ? _Data<U> : R

/**
 * The rule the branch at `K` declares, with any lazy wrapper taken off.
 *
 * `Required<U>[K]` rather than `U[K]`: an optional key's indexed type carries
 * `undefined` for the absence itself, which is not part of the rule. `Variant`
 * declares every key optional, so reading that `undefined` as the rule would
 * make a two-branch repetition written with `?` fail the shape tests and be
 * read as a variant. Optionality names which branches an author wrote down
 * rather than which a match may leave out.
 *
 * Under `exactOptionalPropertyTypes`, `Required` removes the modifier without
 * inventing an `undefined`, so what survives is exactly what the author wrote —
 * which is also what makes it the right thing to test in {@link _Malformed}.
 */
type _BranchOf<U, K extends keyof U> = _Data<Required<U>[K]>

/**
 * The keys of `U` whose branch admits `undefined` *as written* — with the
 * optional modifier taken off, so this is about the declared rule and not about
 * whether the key may be missing.
 *
 * `toData` throws on the value such a key describes, because normalization
 * reads a present property whose value is `undefined`, so a rule with one is
 * not a grammar the parser can process. Both spellings reach it: a required
 * `0 | undefined`, and an optional `?: 0 | undefined`, which
 * `exactOptionalPropertyTypes` still lets hold an explicit `undefined`. A plain
 * `?: 0` is not this — that key is absent or a rule, never present with no
 * value.
 */
type _Malformed<U> =
    { [K in _Keys<U>]: undefined extends Required<U>[K] ? K : never }[_Keys<U>]

/**
 * The keys of `U` that name a branch at all. `variant` in
 * `../data/module.f.mjs` reads branches with `Object.entries`, which never
 * yields a symbol, so a symbol-keyed property is invisible to the grammar and
 * counts towards nothing here — neither a branch of a variant nor a branch that
 * would stop a repetition from being one.
 */
type _Keys<U> = Extract<keyof U, string | number>

/** The keys of `U` whose branch is the empty sequence. */
type _NoneKeys<U> =
    { [K in _Keys<U>]: _BranchOf<U, K> extends readonly [] ? K : never }[_Keys<U>]

/** The keys of `U` whose branch is an item followed by `R` itself. */
type _StepKeys<U, R> =
    { [K in _Keys<U>]: _BranchOf<U, K> extends readonly [Rule, R] ? K : never }[_Keys<U>]

/**
 * The item of `R` when `R` is a repetition, wrapped in a one-tuple, and `false`
 * when it is not one. The miss has to be `false` rather than `never`: `never`
 * is assignable to every type, so a `never` miss would match the one-tuple test
 * that reads the item back out, and every rule would read as a repetition over
 * `never`.
 *
 * The conditions are `repeatOf`'s in `../data/module.f.mjs`, as far as they can
 * be asked of a rule standing on its own: exactly two branches, one of them the
 * empty sequence, the other the item paired with `R`.
 *
 * The branches are matched by *shape*, never by the names `some` and `none`.
 * `repeatOf` reads `definedValues` and never looks at a key, so
 * `{ stop: [], next: [item, R] }` is as much a repetition as `Option`'s own
 * spelling, and asking for `Repeat0Plus`'s names would deny a grammar the
 * parser accepts. Asking only that the `some`/`none` pair is *present* is the
 * opposite error: structural assignability lets a variant carry further
 * branches beside it, and a three-branch rule would flatten to an array and
 * lose the alternatives it can also match.
 *
 * Two of `repeatOf`'s conditions are not asked here, both needing the
 * normalized rule set rather than the rule:
 * [nullable-repeat-item](./todo/nullable-repeat-item.md).
 */
type _RepeatItem<R> =
    R extends () => infer U
        ? _Single<_NoneKeys<U>> extends true
            ? _Single<_StepKeys<U, R>> extends true
                ? Equal<_Keys<U>, _NoneKeys<U> | _StepKeys<U, R>> extends true
                    ? _BranchOf<U, _StepKeys<U, R>> extends readonly [infer I extends Rule, R]
                        ? readonly [I]
                        : false
                    : false
                : false
            : false
        : false

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
 * A symbol key names no branch at all — see {@link _Keys} — and is dropped for
 * that reason, the line `Branch` also draws in `../matcher/types.ts`.
 */
type _Branches<R extends Variant, K> =
    // A rule the parser throws on is refused rather than given the AST of one
    // that works — `_FromAny` would otherwise drop the `undefined` and hand
    // back a plausible branch. See {@link _Malformed}.
    [_Malformed<R>] extends [never]
        ? K extends _Keys<R> ? { readonly [_ in K]: _FromAny<R[K]> } : never
        : never

export type AstRule<R extends Rule> =
    // A rule left at one of the BNF API's own types — `@type {Rule}` and
    // `@type {Sequence}` are how `../lib/json` annotates most of its exports —
    // carries no shape to derive an AST from, so the answer is the widened
    // {@link Ast}. It is also what stops the recursion: `Sequence`'s element
    // type is `Rule`, whose own `Sequence` member would otherwise send the
    // mapping below back through itself forever. Both are asked of the whole of
    // `R`, before it is taken apart.
    Rule extends R ? Ast :
    DataRule extends R ? Ast :
    // Then one member at a time. `R` may be a union of rules, and each is
    // classified on its own: `_RepeatItem` of a union answers for the union,
    // and a `readonly [I] | false` mixture would fail the tuple test below and
    // drop a repetition into the lazy-rule branch.
    R extends Rule ? _AstOne<R> : never

type _AstOne<R extends Rule> =
    _RepeatItem<R> extends readonly [infer I extends Rule] ? readonly AstRule<I>[] :
    R extends () => (infer U extends Rule) ? AstRule<U> :
    R extends TerminalRange ? number : // this is something that would be good to change
    R extends readonly Rule[]
        // Reached with `R` an array, so `Sequence extends R` holds only for the
        // widened `Sequence` itself, never for a tuple.
        ? Sequence extends R ? readonly Ast[] : { readonly [K in keyof R]: _FromAny<R[K]> }
        :
    R extends string ? readonly number[] :
    // A variant is a choice, so its AST is the union of what each branch
    // produces, never the product of all of them: a match selects exactly one,
    // the same contract `Branch` states in `../matcher/types.ts`.
    R extends Variant ? _Branches<R, _Keys<R>> :
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

// A rule widened to one of the BNF API's own types derives no shape, and must
// resolve rather than recurse: `../lib/json` annotates `string` as `Rule` and
// `array`/`object` as returning `Sequence`, so these are the everyday case.
type _15 = Assert<Equal<AstRule<Rule>, Ast>>
type _16 = Assert<Equal<AstRule<DataRule>, Ast>>
type _17 = Assert<Equal<AstRule<Sequence>, readonly Ast[]>>
type _18 = Assert<Equal<AstRule<typeof jsonString>, Ast>>
type _19 = Assert<Equal<AstRule<ReturnType<typeof jsonArray>>, readonly Ast[]>>

// `some`/`none` shaped like a repetition, but with a third branch beside them.
// `repeatOf` in `../data/module.f.mjs` rewrites only a two-branch variant, and
// `repeatItem` returns `null` for this rule, so the parser keeps `other` as an
// ordinary alternative and the AST has to keep all three.
type _Extra = () => {
    readonly some: readonly[0, _Extra],
    readonly none: readonly[],
    readonly other: 1,
}
// The `some` branch refers back to the whole union, so the three branches are
// pinned one at a time rather than written out.
type _20 = Assert<Equal<AstRule<_Extra> extends readonly unknown[] ? true : false, false>>
type _21 = Assert<Equal<
    Extract<AstRule<_Extra>, { readonly other: unknown }>,
    { readonly other: number }>>
type _22 = Assert<Equal<
    Extract<AstRule<_Extra>, { readonly none: unknown }>,
    { readonly none: readonly[] }>>
type _23 = Assert<Equal<
    Extract<AstRule<_Extra>, { readonly some: unknown }>,
    { readonly some: readonly[number, AstRule<_Extra>] }>>

// A union of rules is classified member by member, so a repetition beside an
// ordinary rule stays a repetition.
type _24 = Assert<Equal<AstRule<Repeat0Plus<0> | 1>, readonly number[] | number>>

// `repeatOf` reads branch values and never a key, so a repetition spelled with
// its own tags is one; `repeatItem` returns the item `0` for this rule.
type _Custom = () => {
    readonly stop: readonly[],
    readonly next: readonly[0, _Custom],
}
type _25 = Assert<Equal<AstRule<_Custom>, readonly number[]>>

// A lazy alias in a branch means what its direct form means, since recognition
// runs over the normalized rules; `repeatItem` returns `0` for this one.
type _Empty = () => readonly []
type _LazyBranch = () => {
    readonly none: _Empty,
    readonly some: readonly[0, _LazyBranch],
}
type _26 = Assert<Equal<AstRule<_LazyBranch>, readonly number[]>>

// A symbol-keyed property is not a branch: `variant` reads branches with
// `Object.entries`, so no parse can produce one.
declare const _sym: unique symbol
type _Symbolic = { readonly [_sym]: 0, readonly a: 1 }
type _27 = Assert<Equal<AstRule<_Symbolic>, { readonly a: number }>>

// A symbol beside a repetition's two branches is invisible to `Object.entries`,
// so it does not make the rule a three-branch variant; `repeatItem` returns `0`.
type _SymbolBeside = () => {
    readonly none: readonly[],
    readonly some: readonly[0, _SymbolBeside],
    readonly [_sym]: 1,
}
type _28 = Assert<Equal<AstRule<_SymbolBeside>, readonly number[]>>

// `Variant` declares every key optional, so a repetition may be written with
// `?` on both branches; `repeatItem` returns `0` for the value that shape
// describes.
type _OptionalBranches = () => {
    readonly none?: readonly[],
    readonly some?: readonly[0, _OptionalBranches],
}
type _29 = Assert<Equal<AstRule<_OptionalBranches>, readonly number[]>>

// A *required* branch whose declared type includes `undefined` is not the same
// as an optional one. `repeatItem` throws on the value it describes, because
// normalization reads the present-but-`undefined` property, so this is not a
// repetition and must not be given one's shape.
type _RequiredUndefined = () => {
    readonly none: readonly[] | undefined,
    readonly some: readonly[0, _RequiredUndefined],
}
type _30 = Assert<Equal<AstRule<_RequiredUndefined>, never>>

// The same branch outside a repetition, which is where the shape is refused.
type _31 = Assert<Equal<AstRule<{ readonly a: 0 | undefined }>, never>>

// The optional spelling is not that, and stays a branch: under
// `exactOptionalPropertyTypes` an optional key cannot hold an explicit
// `undefined`, so nothing it describes reaches `Object.entries` as a present
// property with no value.
type _32 = Assert<Equal<AstRule<{ readonly a?: 0 }>, { readonly a: number }>>

// `exactOptionalPropertyTypes` stops `?: 0` holding an explicit `undefined`,
// but not `?: 0 | undefined` — which is the declared rule admitting it, and so
// the same malformed rule as the required spelling.
type _33 = Assert<Equal<AstRule<{ readonly a?: 0 | undefined }>, never>>
