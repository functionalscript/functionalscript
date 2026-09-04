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
 * `toData` throw, and is refused here. The refusal has two holes, both in
 * [nullable-repeat-item](./todo/nullable-repeat-item.md). It does not propagate
 * out of a branch — a malformed rule nested under a variant leaves the
 * alternative beside it standing, where normalization would have refused the
 * whole grammar. And an *open* key set is not refused at all: a declaration
 * such as `{ readonly [k: string]: 0 | undefined }` gets the widened variant,
 * because the `undefined` an index signature carries cannot be told from one an
 * author wrote.
 *
 * A repetition is recognized from the rule alone, which is short of what
 * `repeatOf` in `../data/module.f.mjs` asks: that module also refuses an item
 * that can match empty or that can reach the repetition again, and it asks
 * whether the tail *is* this rule by name where the test below can only ask
 * whether it has this rule's shape. Each is a question about a rule *set*
 * rather than a rule, and the last is beyond reach rather than merely
 * unasked — two rules of the same shape are the same type here, so nothing
 * written against the type can separate them.
 *
 * Those are not the only places this module and the parser disagree. The rest
 * have other causes — an open key set is not refused, a pattern key set is not
 * recognized as open, an object-literal `__proto__` names a branch the parser
 * never sees, and an overloaded rule function is read at the wrong overload.
 * [nullable-repeat-item](./todo/nullable-repeat-item.md) is the whole list, and
 * names the input that breaks each one.
 *
 * Where a rule is written too widely to say whether it repeats — a branch left
 * at `Sequence`, a branch written as a union with the empty sequence in it, an
 * optional branch that a value may leave out, or a whole rule left at
 * `() => Variant` — the answer is both shapes rather than the likelier one:
 * `readonly Ast[]` beside the variant's branches. `lib/json`'s `value` is the
 * last of those, so `json`'s middle element carries the array too.
 *
 * @module
 */

import type { Assert } from "../../asserts/types.ts"
import type {
    array as jsonArray, digit, json, optionNeg, string as jsonString, uint,
} from "../lib/json/module.f.mjs"
import type { Equal } from "../../types/ts/types.ts"
import type { StringMap } from "../../types/object/types.ts"
import type {
    DataRule, Join1Plus, Repeat0Plus, Repeat1Plus, Rule, Sequence, TerminalRange,
    Variant,
} from "../types.ts"

export type Ast =
    // terminal
    number |
    // sequence | repeat
    readonly Ast[] |
    // variant: the one branch that matched, under its own name. The others are
    // absent, not present-and-empty, so the values are optional — a reader that
    // reaches for a branch it did not match must be made to check.
    //
    // This is `StringMap<Ast>` written out, which the rule in `fjs/AGENTS.md`
    // asks for and this one declaration cannot use: an alias may not reference
    // itself through another alias's instantiation, so `StringMap<Ast>` here is
    // `TS2456`. Everything below that answers with the open key set uses the
    // named form.
    { readonly[k in string]?: Ast}

type _FromAny<R> = R extends Rule ? AstRule<R> : never

/** `never` for a union of two or more, so this asks for exactly one member. */
type _Single<T> =
    readonly[T] extends readonly[never]
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
    { readonly[K in _Keys<U>]: undefined extends Required<U>[K] ? K : never }[_Keys<U>]

/**
 * The keys of `U` that name a branch at all. `variant` in
 * `../data/module.f.mjs` reads branches with `Object.entries`, which never
 * yields a symbol, so a symbol-keyed property is invisible to the grammar and
 * counts towards nothing here — neither a branch of a variant nor a branch that
 * would stop a repetition from being one.
 */
type _Keys<U> = Extract<keyof U, string | number>

/**
 * The keys of `U` that cannot be there: optional, with `never` for a rule. Such
 * a key has no value to hold and, under `exactOptionalPropertyTypes`, no
 * `undefined` to hold instead, so `Object.entries` never yields it and it is no
 * more a branch than a symbol key is. A *required* `never` is a different
 * thing — it says no value of the rule exists at all — and is left alone.
 *
 * {@link _Keys} keeps them, and the two places that count branches take them
 * out. Filtering there rather than in `_Keys` keeps `_Keys` a plain `Extract`:
 * as a conditional it stays deferred where the mapped types below index by it,
 * and {@link Equal} reads a deferred key set as different from the same one
 * resolved.
 */
type _BranchKeys<U> = Exclude<_Keys<U>, _Impossible<U>>

type _Impossible<U> =
    { readonly[K in _Keys<U>]:
        {} extends Pick<U, K>
            ? readonly[Required<U>[K]] extends readonly[never] ? K : never
            : never
    }[_Keys<U>]

/**
 * The empty branch, as `repeatOf` sees it. `data` in `../data/module.f.mjs`
 * normalizes a string rule into the sequence of its symbols, so `''` arrives as
 * the empty sequence and terminates a repetition exactly as `readonly[]` does:
 * `repeatItem(() => ({ none: '', some: [0, R] }))` is the item.
 */
type _None = readonly[] | ''

/**
 * The keys of `U` whose branch is the empty branch.
 *
 * A key that cannot be there is taken out afterwards rather than tested for:
 * its branch is `never`, which extends every shape, so it would answer to this
 * test and to {@link _StepKeys} at once. See {@link _Impossible}.
 */
type _NoneKeys<U> =
    Exclude<
        { readonly[K in _Keys<U>]: _BranchOf<U, K> extends _None ? K : never }[_Keys<U>],
        _Impossible<U>>

/** The keys of `U` whose branch is an item followed by `R` itself. */
type _StepKeys<U, R> =
    Exclude<
        { readonly[K in _Keys<U>]: _BranchOf<U, K> extends readonly[Rule, R] ? K : never }[_Keys<U>],
        _Impossible<U>>

/**
 * The item of `R` when `R` is a repetition, wrapped in a one-tuple; `false`
 * when `R` is definitely not one; and `true` when the declaration does not say
 * which. The miss has to be `false` rather than `never`: `never` is assignable
 * to every type, so a `never` miss would match the one-tuple test that reads
 * the item back out, and every rule would read as a repetition over `never`.
 *
 * The third answer is what a widened or ambiguous declaration deserves. A
 * branch typed `Sequence`, or a whole rule left at `() => Variant`, or a branch
 * written as a union with `readonly[]` in it, describes both a grammar that is
 * a repetition and one that is not; a `false` there would be a claim, not an
 * observation. {@link _AstOne} answers such a rule with both shapes.
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
        // The members of `U` are weighed one at a time and their answers put
        // back together. All `false` is `false`. Members that all name an item
        // keep every item: they are repetitions whichever one the rule turns
        // out to be, and {@link _AstOne} answers with an array per item rather
        // than one array over the lot. Anything else — a `true`, or a `false`
        // beside an item — is members disagreeing about whether this repeats at
        // all, which leaves the classification open.
        ? readonly[_Members<U, R>] extends readonly[false] ? false
        : readonly[Extract<_Members<U, R>, boolean>] extends readonly[never] ? _Members<U, R>
        : true
    // A rule that is not lazy cannot name itself, so nothing it holds can be
    // its own tail.
    : false

/**
 * {@link _RepeatItem} over the members of a lazy rule's declared return type.
 *
 * A rule annotated `() => ({ none: [], some: [0, R] } | 1)` describes a
 * repetition and a terminal by one declaration, and `keyof` of that union
 * carries only the keys every member has — none — so weighing it whole reads
 * the repetition away entirely.
 */
type _Members<U, R> = U extends DataRule ? _RepeatOne<U, R> : never

/** {@link _RepeatItem} for a single member of a lazy rule's return type. */
type _RepeatOne<U, R> =
    // Only a variant can be a repetition: `repeatOf` reads a rule's branches,
    // and a sequence, a string or a terminal has none. Saying so first also
    // keeps the open-key tests below off an array, whose `keyof` carries
    // `number` without naming an open key set.
    U extends readonly Rule[] ? false :
    U extends string ? false :
    U extends TerminalRange ? false :
    // An open key set names no branches in particular, so it cannot say which
    // two of them pair up. What it does say is what every branch may hold, and
    // that is enough to rule a repetition out. It is asked before `_Malformed`
    // for the reason {@link _Branches} gives: an open key set carries no branch
    // an author wrote, so there is none to refuse.
    string extends _Keys<U> ? _OpenRepeat<U, R> :
    number extends _Keys<U> ? _OpenRepeat<U, R> :
    // A rule the parser throws on is refused outright by {@link _Branches}, and
    // asking whether it repeats would put an array in front of that refusal.
    readonly[_Malformed<U>] extends readonly[never]
        // Two branches make a repetition, so there has to be a pair to make one
        // from — however widely the branches are written, and however many of
        // them are optional.
        // {@link Equal} rather than the one-tuple guard the rest of the file
        // uses: `readonly[_Pairs<U, R>] extends readonly[never]` reads as `true`
        // for a pair that exists, and takes `Repeat0Plus` with it.
        ? Equal<_Pairs<U, R>, never> extends true ? false
        // A branch the declaration does not pin down leaves the classification
        // open, and so does an optional one: `repeatOf` turns on the branches a
        // value carries, and `?` is the author declining to say.
        : readonly[_UndecidedKeys<U, R>] extends readonly[never]
            ? readonly[_OptionalKeys<U>] extends readonly[never] ? _Repeat<U, R> : true
            : true
        // ...`_Malformed<U>`.
        : false

/**
 * Whether an open key set could be a repetition. It could if the type its index
 * signature gives every branch covers both the empty branch and the step:
 * `Variant` does, since every branch is a `Rule`, where
 * `{ readonly [k: string]: 0 }` covers neither, so no value of it has two
 * branches that pair however many keys turn up.
 */
type _OpenRepeat<U, R> =
    _CouldNone<_BranchOf<U, _Keys<U>>, R> extends true
        ? _CouldStep<_BranchOf<U, _Keys<U>>, R> extends true ? true : false
        : false

/**
 * The pairs of distinct keys of `U` that could be a repetition's empty branch
 * and its step, with every *required* key of `U` among the two.
 *
 * That last condition is what counts the branches, which is the condition
 * `repeatOf` phrases as exactly two. A required key is one every value carries,
 * so a rule with a third required branch beside the pair is never a repetition;
 * neither is `{ none?: [], some: [0, R], other: 1 }`, where dropping the
 * optional `none` leaves no empty branch and keeping it makes three.
 */
type _Pairs<U, R> =
    _Pair<_CouldNoneKeys<U, R>, _CouldStepKeys<U, R>, Exclude<_BranchKeys<U>, _OptionalKeys<U>>>

type _Pair<A, B, Req> =
    A extends unknown
        ? B extends unknown
            ? readonly[A] extends readonly[B] ? never
            : readonly[Exclude<Req, A | B>] extends readonly[never] ? readonly[A, B]
            : never
            : never
        : never

/** {@link _RepeatItem} once every branch of `U` is known to be decided. */
type _Repeat<U, R> =
    _Single<_NoneKeys<U>> extends true
        ? _Single<_StepKeys<U, R>> extends true
            ? Equal<_BranchKeys<U>, _NoneKeys<U> | _StepKeys<U, R>> extends true
                ? _Items<_BranchOf<U, _StepKeys<U, R>>, R>
                : false
            : false
        : false

/**
 * The item of each member of a step branch, one one-tuple per member, and
 * `false` when the branch is not a step after all.
 *
 * `B` is distributed over rather than read whole. A step declared
 * `readonly[0, R] | readonly[readonly[0], R]` is a repetition over `0` or over
 * `readonly[0]` — normalization fixes the item once — where inferring from the
 * union gives one array over both, which no parse produces.
 */
type _Items<B, R> =
    readonly[B] extends readonly[never] ? false :
    B extends readonly[infer I extends Rule, R] ? readonly[I] : false

/**
 * What a branch `B` is, as one of four answers per member of it:
 *
 * - `'none'` — every value of the member is the empty branch;
 * - `'step'` — every value is an item paired with `R`;
 * - `'other'` — no value is either;
 * - `'open'` — the member covers one of them without being it, so values of it
 *   go both ways. `Sequence` and `string` are the plain cases, each containing
 *   an empty branch, and so is `Rule` itself, which is what a variant left at
 *   the API's own types offers for every key.
 *
 * The tests are wrapped in one-tuples, and `_Classes` distributes over `B`
 * instead, so each member is weighed on its own and the answers collected. A
 * union has to be taken apart here: `repeatOf` reads whichever member the value
 * turned out to be, so `readonly[0, R] | 1` holds a step even though the union
 * neither *is* the general step nor *contains* it — `readonly[Rule, R]` is not
 * assignable to the specific `readonly[0, R]`, so asking of the union whole
 * finds nothing.
 */
type _Class<B, R> =
    readonly[B] extends readonly[_None] ? 'none' :
    readonly[B] extends readonly[readonly[Rule, R]] ? 'step' :
    readonly[readonly[]] extends readonly[B] ? 'open' :
    readonly[''] extends readonly[B] ? 'open' :
    readonly[readonly[never, R]] extends readonly[B] ? 'open' :
    'other'

/** {@link _Class} of every member of `B`. */
type _Classes<B, R> = B extends unknown ? _Class<B, R> : never

/**
 * The keys of `U` whose branch the declaration leaves open: its members do not
 * agree on what the branch is, or one of them is open on its own.
 */
type _UndecidedKeys<U, R> =
    { readonly[K in _Keys<U>]: _Undecided<_BranchOf<U, K>, R> extends true ? K : never }[_Keys<U>]

type _Undecided<B, R> =
    readonly[_Classes<B, R>] extends readonly[never] ? false :
    readonly[Extract<_Classes<B, R>, 'open'>] extends readonly[never]
        ? _Single<_Classes<B, R>> extends true ? false : true
        : true

/** The keys of `U` whose branch is, or could be, the empty branch. */
type _CouldNoneKeys<U, R> =
    { readonly[K in _Keys<U>]: _CouldNone<_BranchOf<U, K>, R> extends true ? K : never }[_Keys<U>]

type _CouldNone<B, R> =
    readonly[Extract<_Classes<B, R>, 'none' | 'open'>] extends readonly[never] ? false : true

/** The keys of `U` whose branch is, or could be, an item followed by `R`. */
type _CouldStepKeys<U, R> =
    { readonly[K in _Keys<U>]: _CouldStep<_BranchOf<U, K>, R> extends true ? K : never }[_Keys<U>]

type _CouldStep<B, R> =
    readonly[Extract<_Classes<B, R>, 'step' | 'open'>] extends readonly[never] ? false : true

/**
 * The keys `U` declares optional. `Required` in {@link _BranchOf} reads the
 * branch of such a key, because an optional key still names a branch a match
 * can select; this asks the separate question of whether the branch is there at
 * all, which is what counting them turns on.
 */
type _OptionalKeys<U> =
    Exclude<
        { readonly[K in _Keys<U>]: {} extends Pick<U, K> ? K : never }[_Keys<U>],
        _Impossible<U>>

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
    // An open key set names no branches in particular. There is nothing to
    // enumerate and nothing to validate — `Required<R>[string]` admits
    // `undefined` for the index signature itself, not for any branch an author
    // wrote — so the answer is the widened variant, as it is for every other
    // rule left at one of the API's own types. That is a hole in the refusal
    // and not only a shortcut: a value type that admits `undefined` as written,
    // `{ readonly [k: string]: 0 | undefined }`, is widened here rather than
    // refused, and nothing separates the two `undefined`s:
    // [nullable-repeat-item](./todo/nullable-repeat-item.md).
    //
    // An index signature over `number` is as open as one over `string`; `_Keys`
    // keeps both, and a parse selects one branch under either. A *pattern* key set is open too and is not
    // caught here, because nothing distinguishes it from a finite union of
    // literals: [nullable-repeat-item](./todo/nullable-repeat-item.md).
    string extends _Keys<R> ? StringMap<Ast> :
    number extends _Keys<R> ? StringMap<Ast> :
    // A rule the parser throws on is refused rather than given the AST of one
    // that works — `_FromAny` would otherwise drop the `undefined` and hand
    // back a plausible branch. See {@link _Malformed}.
    readonly[_Malformed<R>] extends readonly[never]
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

type _AstOne<R extends Rule> = _AstOf<R, _RepeatItem<R>>

type _AstOf<R extends Rule, T> =
    // One array per item, not one array over the union of them: a rule that
    // names two repetitions parses as one or the other, never as a sequence
    // mixing their items.
    readonly[T] extends readonly[readonly[Rule]] ? _AstRepeat<T> :
    // A declaration that does not say whether it is a repetition gets both
    // shapes rather than the one it is merely more likely to be. The item is
    // unknown along with the rest, so the array is over the widened `Ast`.
    readonly[T] extends readonly[true] ? readonly Ast[] | _AstNotRepeat<R> :
    _AstNotRepeat<R>

/**
 * The same mapping {@link _AstOne} gives a sequence, with a constant in place of
 * each element's AST: enough to say whether the mapping stayed an array,
 * without deriving an AST to find out. The element types cannot be asked for
 * here — a tuple holding the rule this mapping belongs to would send the
 * derivation through itself, which `tsc` reports as `TS2615`.
 */
type _Shape<R> = { readonly[K in keyof R]: 0 }

type _AstRepeat<T> = T extends readonly[infer I extends Rule] ? readonly AstRule<I>[] : never

type _AstNotRepeat<R extends Rule> =
    R extends () => (infer U extends Rule) ? AstRule<U> :
    R extends TerminalRange ? number : // this is something that would be good to change
    R extends readonly Rule[]
        // Reached with `R` an array, so `Sequence extends R` holds only for the
        // widened `Sequence` itself, never for a tuple.
        ? Sequence extends R ? readonly Ast[]
        // An array carrying own properties beside its indices —
        // `Object.assign([0], { extra: 1 })` — is a sequence the parser reads by
        // index and nothing else. The mapping below is homomorphic over an
        // array and keeps its shape, but not over that intersection: it answers
        // with an object carrying `extra` and every array method mapped through.
        // The answer to that is the array a sequence produces, since the arity
        // cannot be recovered — a recursive destructure of the intersection does
        // not terminate: [nullable-repeat-item](./todo/nullable-repeat-item.md).
        //
        // {@link _Shape} asks whether the mapping came back an array, which is
        // the question itself rather than a guess at which keys are indices:
        // `'-1'` reads as one by name and is not one.
        : _Shape<R> extends readonly unknown[]
            ? { readonly [K in keyof R]: _FromAny<R[K]> }
            : readonly Ast[]
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
    AstRule<{ readonly a: 0, readonly b: 1 }>,
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
// `?` on both branches; `repeatItem` returns `0` for the value with both. But
// the same declaration describes values with one — a one-branch variant that is
// no repetition — and nothing chooses between them, so the answer carries both:
// the array a repetition parses to, over the widened item, beside the branches.
type _OptionalBranches = () => {
    readonly none?: readonly[],
    readonly some?: readonly[0, _OptionalBranches],
}
type _29 = Assert<Equal<AstRule<_OptionalBranches>, _OptionalBranchesAst>>
type _OptionalBranchesAst =
    readonly Ast[] |
    { readonly none: readonly[] } |
    { readonly some: readonly[number, _OptionalBranchesAst] }

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

// The widened `Variant` names no branches, so it is not a malformed rule — it
// is one carrying no shape, like `Rule` and `Sequence` above. `lib/json`'s
// `createValue` is annotated with it, so `json` itself depends on this.
type _34 = Assert<Equal<AstRule<Variant>, StringMap<Ast>>>

// `json` is `[ws, value, ws]`. `value` is `createValue`'s `Variant`, and `ws`
// repeats `wsSymbol`, which `set` gives the same open key set — so the whole
// grammar rests on the widened answer, and read `never` before it existed.
//
// `value` is `() => Variant`: a lazy rule over an open key set, which is the
// one shape that could be a repetition without saying so. `createValue`'s seven
// branches are not one, but that is a fact about the function's body and not
// about the type `json` carries, so the middle element admits the array too.
type _35 = Assert<Equal<
    AstRule<typeof json>,
    readonly[
        readonly StringMap<Ast>[],
        readonly Ast[] | StringMap<Ast>,
        readonly StringMap<Ast>[]]>>

// A numeric index signature is an open key set too: a parse still selects one
// branch, so an arbitrary index is absent rather than an `Ast`.
type _37 = Assert<Equal<AstRule<{ readonly [k: number]: 0 }>, StringMap<Ast>>>

// A lazy rule over the widened `Variant` — `lib/json`'s `value`, in isolation.
// Behind the wrapper the rule can name itself, so an open key set there covers
// a repetition as well as a variant, and both shapes come back. A bare
// `Variant` is not this: nothing it holds can refer to it, so `_34` above is
// the variant alone.
type _38 = Assert<Equal<AstRule<() => Variant>, readonly Ast[] | StringMap<Ast>>>

// A branch left at `Sequence` contains the empty sequence without being it, so
// this describes a repetition over `0` and a two-branch variant alike.
type _WideNone = () => {
    readonly none: Sequence,
    readonly some: readonly[0, _WideNone],
}
type _39 = Assert<Equal<AstRule<_WideNone>, readonly Ast[] | _WideNoneVariant>>
type _WideNoneVariant =
    { readonly none: readonly Ast[] } |
    { readonly some: readonly[number, AstRule<_WideNone>] }

// A branch written as a union with the empty sequence in it is the same
// question asked another way: the member that is `readonly[]` makes a
// repetition, the member that is `1` makes a variant.
type _UnionNone = () => {
    readonly none: readonly[] | 1,
    readonly some: readonly[0, _UnionNone],
}
type _40 = Assert<Equal<AstRule<_UnionNone>, readonly Ast[] | _UnionNoneVariant>>
type _UnionNoneVariant =
    { readonly none: readonly[] | number } |
    { readonly some: readonly[number, AstRule<_UnionNone>] }

// Widening that cannot make a repetition is still decided: a rule with no
// branch that steps is a variant however open its other branches are.
type _WideNoStep = () => {
    readonly none: Sequence,
    readonly other: 0,
}
type _41 = Assert<Equal<
    AstRule<_WideNoStep>,
    { readonly none: readonly Ast[] } | { readonly other: number }>>

// `data` normalizes a string rule into the sequence of its symbols, so `''` is
// the empty sequence and terminates a repetition: `repeatItem` of this rule is
// `0`, checked against `bnf/data`.
type _EmptyString = () => {
    readonly none: '',
    readonly some: readonly[0, _EmptyString],
}
type _42 = Assert<Equal<AstRule<_EmptyString>, readonly number[]>>

// An optional branch is only ambiguity where the branches it leaves could be a
// repetition. Here they cannot: dropping `none` leaves no empty branch, keeping
// it makes three, and `repeatOf` wants exactly two. So this is a variant, with
// no array beside it.
type _OptionalNoPair = () => {
    readonly none?: readonly[],
    readonly some: readonly[0, _OptionalNoPair],
    readonly other: 1,
}
type _43 = Assert<Equal<AstRule<_OptionalNoPair>, _OptionalNoPairAst>>
type _OptionalNoPairAst =
    { readonly none: readonly[] } |
    { readonly some: readonly[number, AstRule<_OptionalNoPair>] } |
    { readonly other: number }

// A lazy *sequence* keeps its arity. `keyof` of an array carries `number`, which
// would read as an open key set, but only a variant can be a repetition at all.
type _44 = Assert<Equal<
    AstRule<() => readonly[0, 1]>,
    readonly[number, number]>>

// An open key set that can hold neither the empty branch nor a step is not a
// repetition however many keys a value turns out to have.
type _45 = Assert<Equal<
    AstRule<() => { readonly[k: string]: 0 }>,
    StringMap<Ast>>>

// A lazy rule may be annotated with a union of return types, and `keyof` of a
// union keeps only the keys every member has — none here — so weighing it whole
// would read the repetition away. The members are weighed one at a time.
type _UnionReturn = () => ({
    readonly none: readonly[],
    readonly some: readonly[0, _UnionReturn],
} | 1)
type _46 = Assert<Equal<
    AstRule<_UnionReturn>,
    readonly Ast[] | _UnionReturnAst | number>>
type _UnionReturnAst =
    { readonly none: readonly[] } |
    { readonly some: readonly[number, AstRule<_UnionReturn>] }

// A union-valued *step* branch. `repeatOf` reads whichever member the value
// turned out to be, so the tuple member makes this a repetition — but asking
// the union whole finds nothing, since `readonly[Rule, R]` is neither what the
// union is nor assignable to its specific `readonly[0, _UnionStep]` member. The
// members are classified one at a time.
type _UnionStep = () => {
    readonly none: readonly[],
    readonly some: readonly[0, _UnionStep] | 1,
}
type _47 = Assert<Equal<AstRule<_UnionStep>, readonly Ast[] | _UnionStepVariant>>
type _UnionStepVariant =
    { readonly none: readonly[] } |
    { readonly some: readonly[number, AstRule<_UnionStep>] | number }

// Two return alternatives that are both repetitions, over different items. Each
// is definite, so the answer is a repetition either way — one array per item
// rather than the variant's branches beside them.
type _TwoRepeats = () => ({
    readonly none: readonly[],
    readonly some: readonly[0, _TwoRepeats],
} | {
    readonly stop: readonly[],
    readonly next: readonly[readonly[0], _TwoRepeats],
})
type _48 = Assert<Equal<
    AstRule<_TwoRepeats>,
    readonly number[] | readonly (readonly[number])[]>>


// A sequence carrying own properties beside its indices, which
// `Object.assign([0] as const, { extra: 1 as const })` produces. `toData` takes
// the array path and reads the indices, so this is a working grammar; the
// mapping that keeps a tuple's arity does not survive the intersection, so the
// answer is the array a sequence produces without its length.
type _49 = Assert<Equal<
    AstRule<readonly[0] & { readonly extra: 1 }>,
    readonly Ast[]>>

// The arity is kept for a plain tuple, which is the case the widening above
// must not reach.
type _50 = Assert<Equal<AstRule<readonly[0]>, readonly[number]>>

// A union inside the step's *tail*. The value whose tail is the rule is a
// repetition — `repeatItem` gives `0` for it — and the one whose tail is `1` is
// a plain pair; the outer distribution never reaches inside the tuple, so this
// is caught by asking whether a specific pair is among the branch's values.
type _TailUnion = () => {
    readonly none: readonly[],
    readonly some: readonly[0, _TailUnion | 1],
}
type _51 = Assert<Equal<AstRule<_TailUnion>, readonly Ast[] | _TailUnionVariant>>
type _TailUnionVariant =
    { readonly none: readonly[] } |
    { readonly some: readonly[number, AstRule<_TailUnion> | number] }

// `'-1'` is a `${number}` and is not an array index: iteration ignores it, and
// `toData` of this builds the same one-element sequence as `_49`'s. What
// separates a sequence from an augmented one is whether the mapping stayed an
// array, not whether a key reads like an index.
type _52 = Assert<Equal<
    AstRule<readonly[0] & { readonly '-1': 1 }>,
    readonly Ast[]>>


// An optional branch whose rule is `never` cannot be there:
// `exactOptionalPropertyTypes` keeps it from holding an `undefined` instead, so
// `Object.entries` never yields it and every value has exactly the two branches
// a repetition needs. Optionality is only ambiguity where the key could turn up.
type _ImpossibleBranch = () => {
    readonly none: readonly[],
    readonly some: readonly[0, _ImpossibleBranch],
    readonly impossible?: never,
}
type _53 = Assert<Equal<AstRule<_ImpossibleBranch>, readonly number[]>>

// A step branch declared as a union of steps over different items. Each is a
// repetition, and normalization fixes the item once, so the answer is one array
// per item rather than one array over both — the same reading `_48` gets for
// two return alternatives, asked of one branch.
type _UnionItem = () => {
    readonly none: readonly[],
    readonly some: readonly[0, _UnionItem] | readonly[readonly[0], _UnionItem],
}
// Written as three assignability tests rather than one `Equal`: the item's own
// AST stays deferred behind the distribution, and a deferred type is not
// identical to the same one written out. What the answer must say is that each
// array on its own is one of the shapes and a sequence mixing the two is not.
type _54 = Assert<readonly number[] extends AstRule<_UnionItem> ? true : false>
type _55 = Assert<
    readonly (readonly[number])[] extends AstRule<_UnionItem> ? true : false>
type _56 = Assert<
    readonly[number, readonly[number]] extends AstRule<_UnionItem> ? false : true>





