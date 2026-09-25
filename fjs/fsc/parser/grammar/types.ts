/**
 * Type-level API of the djs module grammar: the alphabet it is written
 * over, the shapes its helpers build, and the value, which names itself
 * and so is spelled here, as `JsonValue` is in
 * `fjs/ebnf/lib/json/types.ts` — a named type a `const` binding may be
 * annotated with.
 *
 * @module
 */

import type { Assert } from '../../../asserts/types.ts'
import type { Option, RepeatFrom, Rule } from '../../../ebnf/types.ts'
import type { Equal } from '../../../types/ts/types.ts'
import type { DjsToken } from '../../tokenizer/types.ts'
import type {
    _framingKeywords,
    _ordinaryTokenNames,
    _tokenKindNames,
    constStatement,
    identifier,
    identifierName,
    index,
    key,
    primitive,
    sameLine,
    trivia,
} from './module.f.mjs'

// The alphabet the grammar is written over is described twice — as the lists
// `./module.f.mjs` registers and as the unions below — and the four pins that
// keep the two agreeing sit beside those unions.
//
// They were `./proof.f.mjs`'s `consistency` entry, a body of nothing but
// typedefs, so none of them bound to a statement and all four were green
// whatever they claimed (`../../../AGENTS.md` §1.4). That entry's own comment
// said the function body existed only to give the typedefs a scope, which is
// the shape exactly.

/**
 * The words a rule requires in some position — six framing a module and
 * `return` framing a function's block body and `as` an import alias — which the grammar has to tell
 * apart from an ordinary identifier.
 *
 * The tokenizer emits these words as `{ kind: 'id' }` with the word in `value`, so
 * a parser layer keyed on `kind` alone would give them the same symbol as any
 * other identifier — and a grammar over that alphabet could not distinguish
 * `export default` from two arbitrary names. They therefore get terminals of
 * their own, which is what a registered alphabet allows: a name's symbol comes
 * from its position in the list, so a name has no length limit.
 */
export type _FramingKeyword = 'import' | 'const' | 'export' | 'default' | 'from' | 'with' | 'return' | 'as'

type _KeywordsAreComplete = Assert<Equal<(typeof _framingKeywords)[number], _FramingKeyword>>

/**
 * A token name the grammar can name as a terminal: every `DjsToken` kind
 * except `eof`, plus the keywords with symbols of their own.
 *
 * `eof` is excluded because the backend synthesizes its own logical
 * end-of-input; the tokenizer's physical `eof` token is split off the stream
 * before any name is mapped, so it never reaches this alphabet.
 *
 * The kinds are derived from `DjsToken` rather than listed, so a token kind
 * added there cannot silently go unrepresented at the parser layer.
 */
export type _OrdinaryTokenName = Exclude<DjsToken['kind'], 'eof'> | _FramingKeyword

type _KindsAreComplete = Assert<Equal<(typeof _tokenKindNames)[number], Exclude<DjsToken['kind'], 'eof'>>>
type _AlphabetIsComplete = Assert<Equal<(typeof _ordinaryTokenNames)[number], _OrdinaryTokenName>>

// `eof` is not a member of the alphabet, so a second end marker cannot be
// encoded rather than merely going unused — and `encode` would reject the name
// outright. Checked at the type level because that is where it is decidable:
// `includes('eof')` does not even compile against this element type.
type _EofIsNotAName = Assert<Equal<Extract<_OrdinaryTokenName, 'eof'>, never>>

/**
 * A comma-separated list of `Item`s, at least one, a trailing comma
 * allowed: an item and its trivia, then optionally a comma, its trivia, and
 * the rest of the list — or nothing after the comma, which is the trailing
 * one. Right-recursive, so that one symbol of lookahead decides whether a
 * comma is followed by an item or by the closing bracket.
 *
 * The rest of the list is the list itself, which the type leaves as
 * `Rule`: a type that named itself there would nest a list inside every
 * list a value holds, which is more than `tsc` unrolls (TS2589), and a
 * reader takes the rest from the list's own mapping — one symbol by then —
 * rather than from the type.
 */
export type Items<Item extends Rule> = () => readonly ['const', readonly [
    Item,
    Option<readonly [number, typeof trivia, Option<Rule>]>,
]]

/** An opening symbol, trivia, an optional list, the closing symbol, and the trivia after it. */
export type Container<Item extends Rule> = readonly [number, typeof trivia, Option<Items<Item>>, number, typeof trivia]

/** A key, trivia, `:`, trivia, and a value. */
export type Member = readonly [typeof key, typeof trivia, number, typeof trivia, Value]

/**
 * One step after a value: `.name`, `[key]`, or a call and its arguments.
 *
 * Spelled here rather than inferred, as {@link Value} is and for the same
 * reason: a call holds values, a value takes steps, so the two name each
 * other and neither can be read off its own initializer.
 */
export type Access = {
    readonly property: readonly [number, typeof trivia, typeof identifierName, typeof trivia]
    readonly index: readonly [number, typeof trivia, typeof index, typeof trivia, number, typeof trivia]
    readonly call: readonly [number, typeof trivia, Option<Items<Value>>, number, typeof trivia]
}

/**
 * `**`'s right operand, when a primary, a group, or a `-`/`~` is raised to
 * a power: optional, and {@link Unary} again when present — right-recursive,
 * so `2 ** 3 ** 2` is `2 ** (3 ** 2)`.
 */
export type PowTail = Option<readonly [number, typeof trivia, Unary]>

/**
 * What a `-` or a `~` takes: a value less the function, JavaScript's unary
 * operand being a `UnaryExpression`, which an arrow function is not — and a
 * group, {@link ParenGroup}, which is one. Every alternative but the two
 * prefixes may be raised to a power, {@link PowTail}; the prefixes
 * themselves recurse into {@link UnaryOperand}, never {@link Unary}, since
 * JavaScript refuses `**` immediately after a unary-prefixed operand.
 */
export type Unary = () => readonly ['const', {
    readonly neg: readonly [number, typeof trivia, UnaryOperand]
    readonly bitnot: readonly [number, typeof trivia, UnaryOperand]
    readonly primitive: readonly [readonly [readonly [typeof primitive, typeof trivia], RepeatFrom<0, Access>], PowTail]
    readonly ref: readonly [readonly [readonly [typeof identifier, typeof trivia], RepeatFrom<0, Access>], PowTail]
    readonly array: readonly [readonly [Container<Value>, RepeatFrom<0, Access>], PowTail]
    readonly object: readonly [readonly [Container<Member>, RepeatFrom<0, Access>], PowTail]
    readonly group: ParenGroup
}]

/**
 * What a `-` or a `~` takes: every alternative {@link Unary} has, but none
 * of them — including a nested `-`/`~`, recursing through this same type —
 * carries {@link PowTail}. JavaScript refuses `**` immediately after a
 * unary-prefixed operand at any depth, `- -2 ** 2` exactly as `- 2 ** 2`,
 * so recursing through this type rather than {@link Unary} keeps that
 * refusal at every depth a `-`/`~` chain reaches.
 */
export type UnaryOperand = () => readonly ['const', {
    readonly neg: readonly [number, typeof trivia, UnaryOperand]
    readonly bitnot: readonly [number, typeof trivia, UnaryOperand]
    readonly primitive: readonly [readonly [readonly [typeof primitive, typeof trivia], RepeatFrom<0, Access>]]
    readonly ref: readonly [readonly [readonly [typeof identifier, typeof trivia], RepeatFrom<0, Access>]]
    readonly array: readonly [readonly [Container<Value>, RepeatFrom<0, Access>]]
    readonly object: readonly [readonly [Container<Member>, RepeatFrom<0, Access>]]
    readonly group: ParenGroupOperand
}]

/**
 * One round of a binary-operator layer above {@link Unary}: `(op, Unary,
 * ...Prev)`, the op itself left untyped — nothing downstream reads its
 * shape at the type level, only at the value level once a round is
 * matched — and `Prev` the layers below this one, threaded through so a
 * repeated operand reaches back down to them, `1 + 2 * 3` nesting as
 * `1 + (2 * 3)`.
 *
 * The operand is always {@link Unary}, never {@link Value}/{@link Body}
 * themselves: a function's body is unbounded, reading everything to the
 * right of `=>` as its own, so wrapping a shared primary as a unit — as a
 * single generic `Below` this alias once took — would leak the ladder's
 * own follow set down into the function's body and manufacture an LL(1)
 * conflict `fjs/ebnf/ll1` has no way to resolve. See `unary`'s own comment
 * in `./module.f.mjs`.
 */
type _OpRound<Prev extends readonly Rule[]> = readonly [Rule, typeof trivia, Unary, ...Prev]

/** One layer of the precedence ladder: zero or more {@link _OpRound}s over the layers below it. */
type _OpTail<Prev extends readonly Rule[]> = RepeatFrom<0, _OpRound<Prev>>

type _MultiplicativeTail = _OpTail<readonly []>
type _AdditiveTail = _OpTail<readonly [_MultiplicativeTail]>
type _ShiftTail = _OpTail<readonly [_MultiplicativeTail, _AdditiveTail]>
type _RelationalTail = _OpTail<readonly [_MultiplicativeTail, _AdditiveTail, _ShiftTail]>
type _EqualityTail = _OpTail<readonly [_MultiplicativeTail, _AdditiveTail, _ShiftTail, _RelationalTail]>
type _BitwiseAndTail = _OpTail<readonly [_MultiplicativeTail, _AdditiveTail, _ShiftTail, _RelationalTail, _EqualityTail]>
type _BitwiseXorTail = _OpTail<readonly [_MultiplicativeTail, _AdditiveTail, _ShiftTail, _RelationalTail, _EqualityTail, _BitwiseAndTail]>
type _BitwiseOrTail = _OpTail<readonly [_MultiplicativeTail, _AdditiveTail, _ShiftTail, _RelationalTail, _EqualityTail, _BitwiseAndTail, _BitwiseXorTail]>

/**
 * The eager binary-operator suffix, `multiplicative` through `bitwiseOr`,
 * each layer built on the ones below it, `bitwiseOr` this type's own top:
 * the first part of {@link Tail}, and every lazy operator's own operand —
 * {@link Unary} followed by these eight, which is what a `bitwiseOr`-level
 * expression is.
 */
export type EagerTail = readonly [
    _MultiplicativeTail, _AdditiveTail, _ShiftTail, _RelationalTail,
    _EqualityTail, _BitwiseAndTail, _BitwiseXorTail, _BitwiseOrTail,
]

/** One round of the `&&` layer: its operand every eager layer's, `a && b | c` being `a && (b | c)`. */
type _LogicalAndRound = _OpRound<EagerTail>

/** The `&&` rounds after a chain's first. */
type _LogicalAndTail = RepeatFrom<0, _LogicalAndRound>

/** One round of the `||` layer: its operand a `&&` chain, `a || b && c` being `a || (b && c)`. */
type _LogicalOrRound = _OpRound<readonly [...EagerTail, _LogicalAndTail]>

/** The `||` rounds after a chain's first. */
type _LogicalOrTail = RepeatFrom<0, _LogicalOrRound>

/** One round of the `??` layer: its operand every eager layer's, and never a `&&` or `||` chain. */
type _NullishRound = _OpRound<EagerTail>

/** The `??` rounds after a chain's first. */
type _NullishTail = RepeatFrom<0, _NullishRound>

/**
 * The short-circuit level above {@link EagerTail}: nothing, or the chain
 * its first operator commits to — each branch that operator's own round
 * and then the repeat lists that may continue it, a `&&` chain continuing
 * into `||` rounds and a `??` chain into `??` rounds alone, so that
 * `a ?? b || c` and `a && b ?? c` have no parse, as JavaScript has none.
 * The shape's own comment is on `circuitTail` in `./module.f.mjs`.
 */
export type CircuitTail = Option<{
    readonly logicalAnd: readonly [_LogicalAndRound, _LogicalAndTail, _LogicalOrTail]
    readonly logicalOr: readonly [_LogicalOrRound, _LogicalOrTail]
    readonly nullish: readonly [_NullishRound, _NullishTail]
}>

/**
 * The conditional above {@link CircuitTail}: nothing, or `?`, trivia, an
 * arm, `:`, trivia, and the other arm — each arm a whole {@link Value}, so
 * a nested conditional associates to the right through the arm's own
 * recursion.
 */
export type ConditionalTail = Option<readonly [number, typeof trivia, Value, number, typeof trivia, Value]>

/**
 * The whole operator suffix: {@link EagerTail}, then the two lazy
 * positions above it, {@link CircuitTail} and {@link ConditionalTail},
 * this type's own top — spread onto every branch of {@link Value}/{@link
 * Body} that may carry one, every branch but {@link Func} and {@link
 * Block}.
 */
export type Tail = readonly [...EagerTail, CircuitTail, ConditionalTail]

/**
 * A value: a primitive token, a reference, an array of values, or an
 * object of members, each ending with its trivia and each followed by the
 * accesses after it and optionally raised to a power — or a `-`/`~`
 * prefix — each carrying {@link Tail}, the binary-operator suffix, above
 * it — or `(`, the choice between a function and a group, {@link Paren},
 * a function alone excepted, nothing following one unparenthesized. A
 * `const` thunk whose payload names the thunk, which is what lets a type
 * alias name itself.
 */
export type Value = () => readonly ['const', {
    readonly neg: readonly [number, typeof trivia, UnaryOperand, ...Tail]
    readonly bitnot: readonly [number, typeof trivia, UnaryOperand, ...Tail]
    readonly primitive: readonly [readonly [readonly [typeof primitive, typeof trivia], RepeatFrom<0, Access>], PowTail, ...Tail]
    readonly name: readonly [typeof identifier, typeof sameLine, ArrowOrRest]
    readonly array: readonly [readonly [Container<Value>, RepeatFrom<0, Access>], PowTail, ...Tail]
    readonly object: readonly [readonly [Container<Member>, RepeatFrom<0, Access>], PowTail, ...Tail]
    readonly paren: Paren
}]

/**
 * A function's body: a value less the object, since `=> {` opens a block
 * in JavaScript — or that block, in which an object is a value again, or
 * a group, which is the other spelling of a body that is an object.
 */
export type Body = () => readonly ['const', {
    readonly neg: readonly [number, typeof trivia, UnaryOperand, ...Tail]
    readonly bitnot: readonly [number, typeof trivia, UnaryOperand, ...Tail]
    readonly primitive: readonly [readonly [readonly [typeof primitive, typeof trivia], RepeatFrom<0, Access>], PowTail, ...Tail]
    readonly name: readonly [typeof identifier, typeof sameLine, ArrowOrRest]
    readonly array: readonly [readonly [Container<Value>, RepeatFrom<0, Access>], PowTail, ...Tail]
    readonly paren: Paren
    readonly block: Block
}]

/** `(`, trivia, and what it opens: the one alternative a `(` starts. */
export type Paren = readonly [number, typeof trivia, Parenthesized]

/**
 * What a `(` opens: the rest of a function whose list is the rest
 * parameter or empty, or a value and what follows it, {@link AfterValue}.
 * Spelled here, as {@link Value} is: the branches reach the value rule,
 * which names itself.
 */
export type Parenthesized = {
    readonly func: Func
    readonly value: readonly [Value, AfterValue]
}

/**
 * What follows the value a `(` opened: `,`, trivia, the names after the
 * first, `)`, same-line trivia, `=>`, trivia and the body — a named
 * parameter list — or `)`, same-line trivia and {@link ArrowOrRest}.
 */
export type AfterValue = {
    readonly list: readonly [number, typeof trivia, Option<ParameterNames>, number, typeof sameLine, number, typeof trivia, Body]
    readonly closed: readonly [number, typeof sameLine, ArrowOrRest]
}

/**
 * What follows a name, or a `( value )`: `=>`, trivia and the body, the
 * name or the value being the one parameter — or the rest of the value:
 * the trivia from the newline `sameLine` stopped at, if any, the steps,
 * the power and the binary layers, exactly as {@link Value}'s other
 * branches carry them.
 */
export type ArrowOrRest = {
    readonly func: readonly [number, typeof trivia, Body]
    readonly rest: readonly [Option<readonly [number, typeof trivia]>, RepeatFrom<0, Access>, PowTail, ...Tail]
}

/** The named parameters after the first: each a name and its trivia, listed as {@link Items} lists anything. */
export type ParameterNames = () => readonly ['const', {
    readonly rest: readonly [number, typeof trivia, typeof identifierName, typeof trivia]
    readonly fixed: readonly [readonly [typeof identifierName, typeof trivia], Option<readonly [number, typeof trivia, Option<ParameterNames>]>]
}]

/**
 * A group after its `(`, under a `-`/`~`: the value, `)`, the trivia after
 * it, the steps the group takes — which are the group's and not the
 * value's, the one thing the parentheses change — and the power it may be
 * raised to, {@link PowTail}. A value's own `(` reads its group through
 * {@link AfterValue} instead, where `=>` may follow the `)`.
 */
export type Group = readonly [Value, number, typeof trivia, RepeatFrom<0, Access>, PowTail]

/**
 * `(`, trivia and a group: what a `-` may take in parentheses. It is not
 * {@link Paren}, which a function shares — `-(...a) => 1` is a syntax error
 * in JavaScript, and `-((...a) => 1)` is not, the group being the
 * `UnaryExpression` the function is not.
 */
export type ParenGroup = readonly [number, typeof trivia, Group]

/**
 * A group after its `(`, without the power {@link Group} itself may carry:
 * everything {@link Group} has but its own {@link PowTail}. `-(1) ** 2` is
 * a syntax error in JavaScript, so {@link UnaryOperand}'s restricted `(`
 * stands on this type rather than {@link Group}'s.
 */
export type GroupOperand = readonly [Value, number, typeof trivia, RepeatFrom<0, Access>]

/**
 * `(`, trivia and {@link GroupOperand}: what a `-`/`~` may take in
 * parentheses, {@link UnaryOperand}'s own `(` branch.
 */
export type ParenGroupOperand = readonly [number, typeof trivia, GroupOperand]

/**
 * `{`, trivia, the body's `const` statements, `return`, same-line trivia,
 * the value, `;`, trivia, `}`, and the trivia after it.
 *
 * The statements are {@link constStatement}, the module's own rule: a body
 * binds names the way a module does, and which scope a name lands in is the
 * fold's answer, not the grammar's.
 */
export type Block = readonly [number, typeof trivia, RepeatFrom<0, typeof constStatement>, number, typeof sameLine, Value, number, typeof trivia, number, typeof trivia]

/**
 * The one rest parameter, when a function has one: `...`, trivia, the
 * parameter, and its trivia.
 *
 * The parameter is an {@link identifierName} and not an `identifier`: a
 * binding takes every word a name may be, and the fold refuses the reserved
 * ones by name. The narrower rule would still typecheck — it is assignable
 * to the wider one — while leaving `Children<Func>` unable to hold a tree
 * the grammar produces.
 */
export type Parameter = readonly [number, typeof trivia, typeof identifierName, typeof trivia]

/** A function's parameter list where it begins with no value: the one rest parameter, or nothing. */
export type Parameters = Option<Parameter>

/**
 * A function after its `(`, which is {@link Paren}'s, where the list is
 * the rest parameter or empty: that list, `)`, same-line trivia, `=>`,
 * trivia, and the body.
 */
export type Func = readonly [Parameters, number, typeof sameLine, number, typeof trivia, Body]

// Which of the two rules the parameter is, pinned — one guard per
// direction, since neither covers both:
//
// - narrow the *rule* in `./module.f.mjs` and the annotation catches it,
//   `TS2740`, the literal being short the six properties `identifierName`
//   demands;
// - narrow *this alias* and nothing does. The rule stays assignable to the
//   narrower type, having more properties than it asks for, so `tsc` is
//   silent — measured by removing this line and seeing a clean build.
//
// So this assertion guards the second direction alone, which is the one
// that would leave `Children<Func>` unable to hold a tree the grammar
// produces while every file still compiles.
type _FuncParameterIsAName = Assert<Equal<Parameter[2], typeof identifierName>>

/** An export and the declarations after a named export; default ends the module. */
export type ExportStatement = () => readonly ['const', readonly [number, typeof trivia, {
    readonly default: readonly [number, typeof trivia, Value, number, typeof trivia]
    readonly named: readonly [typeof constStatement, RepeatFrom<0, typeof constStatement>, Option<Rule>]
}]]
