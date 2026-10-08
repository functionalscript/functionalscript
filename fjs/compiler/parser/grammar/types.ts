/**
 * Type-level API of the module grammar: the alphabet it is written
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
import type { BinaryTag } from '../../ast/types.ts'
import type { literalWords } from '../../../js/keywords/module.f.mjs'
import type {
    _framingKeywords,
    _ordinaryTokenNames,
    _tokenKindNames,
    _valueKinds,
    constStatement,
    identifier,
    identifierName,
    primitive,
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
 * The words a rule requires in some position — six framing a module,
 * `return` and `throw` ending a function's block body, `throw` a module
 * too, `if` opening a guard in one, `as` an import alias, and `typeof` a
 * prefix opening a value — which the
 * grammar has to tell apart from an ordinary identifier.
 *
 * The tokenizer emits these words as `{ kind: 'id' }` with the word in `value`, so
 * a parser layer keyed on `kind` alone would give them the same symbol as any
 * other identifier — and a grammar over that alphabet could not distinguish
 * `export default` from two arbitrary names. They therefore get terminals of
 * their own, which is what a registered alphabet allows: a name's symbol comes
 * from its position in the list, so a name has no length limit.
 */
export type _FramingKeyword = 'import' | 'const' | 'export' | 'default' | 'from' | 'with' | 'return' | 'throw' | 'if' | 'as' | 'typeof' | 'instanceof'

/**
 * Every infix operator the grammar's binary layers read: the AST's own
 * {@link BinaryTag}s, whose node is two operands, and `instanceof`, whose
 * right operand the fold reads as a constructor name rather than a value —
 * so it is a layer's operator here and not a binary tag there.
 */
export type InfixTag = BinaryTag | 'instanceof'

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

// The token kinds that are a whole value are one list, `_valueKinds`; the
// `primitive` variant spells one branch per kind, and `identifierName` admits
// the six words among them as names. A kind added to the list, or a branch
// added to either variant, breaks the build here rather than going
// unrepresented on the other side.
type _ValueKindsArePrimitive = Assert<Equal<keyof typeof primitive, (typeof _valueKinds)[number]>>
// `typeof` is the one framing keyword a name may be and a reference may not,
// which `_framingKeywords`'s own comment explains.
type _ValueKindsAreNames = Assert<Equal<Exclude<keyof typeof identifierName, keyof typeof identifier | 'typeof'>, (typeof literalWords)[number]>>

// `eof` is not a member of the alphabet, so a second end marker cannot be
// encoded rather than merely going unused — and `encode` would reject the name
// outright. Checked at the type level because that is where it is decidable:
// `includes('eof')` does not even compile against this element type.
type _EofIsNotAName = Assert<Equal<Extract<_OrdinaryTokenName, 'eof'>, never>>

/**
 * A comma-separated list of `Item`s, at least one, a trailing comma
 * allowed: an item, then optionally a comma and the rest of the list — or
 * nothing after the comma, which is the trailing one. Right-recursive, so that one symbol of lookahead decides whether a
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
    Option<readonly [number, Option<Rule>]>,
]]

/** An opening symbol, an optional list, and the closing symbol. */
export type Container<Item extends Rule> = readonly [number, Option<Items<Item>>, number]

/** A member of an object, by its key's spelling: a bare identifier and, optionally, `:` and a value, or a string literal or a computed `["a"]`, each with its `:` and value. */
export type Member = {
    readonly plain: readonly [typeof identifierName, Option<readonly [number, Value]>]
    readonly string: readonly [number, number, Value]
    readonly computed: readonly [number, number, number, number, Value]
}

/** An entry of an object: `...` and a value, or a member. */
export type Entry = {
    readonly spread: readonly [number, Value]
    readonly member: Member
}

/** An item of an array or of a call's arguments: a value, or `...` and a value. */
export type Item = {
    readonly spread: readonly [number, Value]
    readonly value: Value
}

/**
 * One step after a value: `.name`, `[key]`, or a call and its arguments.
 *
 * Spelled here rather than inferred, as {@link Value} is and for the same
 * reason: a call holds values, a value takes steps, so the two name each
 * other and neither can be read off its own initializer.
 */
export type Access = {
    readonly property: readonly [number, typeof identifierName]
    readonly index: readonly [number, Value, number]
    readonly call: readonly [number, Option<Items<Item>>, number]
    readonly optional: readonly [number, OptionalStep]
}

/**
 * What follows `?.`: {@link Access}'s three steps less the `.` a property's
 * spelling begins with, which the `?.` has — a property by its name alone,
 * an index and a call as they are.
 */
export type OptionalStep = {
    readonly property: typeof identifierName
    readonly index: readonly [number, Value, number]
    readonly call: readonly [number, Option<Items<Item>>, number]
}

/**
 * `**`'s right operand, when a primary, a group, or a prefix is raised to
 * a power: optional, and {@link Unary} again when present — right-recursive,
 * so `2 ** 3 ** 2` is `2 ** (3 ** 2)`.
 */
export type PowTail = Option<readonly [number, Unary]>

/**
 * What a prefix takes: a value less the function, JavaScript's
 * unary operand being a `UnaryExpression`, which an arrow function is not —
 * and a group, {@link ParenGroup}, which is one. Every alternative but the
 * three prefixes may be raised to a power, {@link PowTail}; the prefixes
 * themselves recurse into {@link UnaryOperand}, never {@link Unary}, since
 * JavaScript refuses `**` immediately after a unary-prefixed operand.
 */
export type Unary = () => readonly ['const', {
    readonly neg: readonly [number, UnaryOperand]
    readonly bitnot: readonly [number, UnaryOperand]
    readonly not: readonly [number, UnaryOperand]
    readonly typeof: readonly [number, UnaryOperand]
    readonly primitive: readonly [readonly [typeof primitive, RepeatFrom<0, Access>], PowTail]
    readonly ref: readonly [readonly [typeof identifier, RepeatFrom<0, Access>], PowTail]
    readonly array: readonly [readonly [Container<Item>, RepeatFrom<0, Access>], PowTail]
    readonly object: readonly [readonly [Container<Entry>, RepeatFrom<0, Access>], PowTail]
    readonly group: ParenGroup
}]

/**
 * What a prefix takes: every alternative {@link Unary} has, but
 * none of them — including a nested prefix, recursing through this same
 * type — carries {@link PowTail}. JavaScript refuses `**` immediately after a
 * unary-prefixed operand at any depth, `- -2 ** 2` exactly as `- 2 ** 2`,
 * so recursing through this type rather than {@link Unary} keeps that
 * refusal at every depth a prefix chain reaches.
 */
export type UnaryOperand = () => readonly ['const', {
    readonly neg: readonly [number, UnaryOperand]
    readonly bitnot: readonly [number, UnaryOperand]
    readonly not: readonly [number, UnaryOperand]
    readonly typeof: readonly [number, UnaryOperand]
    readonly primitive: readonly [readonly [typeof primitive, RepeatFrom<0, Access>]]
    readonly ref: readonly [readonly [typeof identifier, RepeatFrom<0, Access>]]
    readonly array: readonly [readonly [Container<Item>, RepeatFrom<0, Access>]]
    readonly object: readonly [readonly [Container<Entry>, RepeatFrom<0, Access>]]
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
type _OpRound<Prev extends readonly Rule[]> = readonly [Rule, Unary, ...Prev]

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
 * The conditional above {@link CircuitTail}: nothing, or `?`, an arm, `:`
 * and the other arm — each arm a whole {@link Value}, so
 * a nested conditional associates to the right through the arm's own
 * recursion.
 */
export type ConditionalTail = Option<readonly [number, Value, number, Value]>

/**
 * The whole operator suffix: {@link EagerTail}, then the two lazy
 * positions above it, {@link CircuitTail} and {@link ConditionalTail},
 * this type's own top — spread onto every branch of {@link Value}/{@link
 * Body} that may carry one, every branch but {@link Func} and {@link
 * Block}.
 */
export type Tail = readonly [...EagerTail, CircuitTail, ConditionalTail]

/**
 * The branches {@link Value} and {@link Body} both start with: a primitive
 * token, a reference, or an array of values, each followed by the
 * accesses after it and optionally raised to a power — or a prefix
 * prefix — each carrying {@link Tail}, the binary-operator suffix, above
 * it — or `(`, the choice between a function and a group, {@link Paren},
 * a function alone excepted, nothing following one unparenthesized.
 *
 * {@link Value} and {@link Body} add to it with `&`, not a named field: a
 * rule's branches are one flat record whose keys are its alternatives, so
 * a nested field would describe a different grammar — the flat-shape
 * exception to `fjs/AGENTS.md` §3.2, "Composition over intersection".
 */
export type ValueBranches = {
    readonly neg: readonly [number, UnaryOperand, ...Tail]
    readonly bitnot: readonly [number, UnaryOperand, ...Tail]
    readonly not: readonly [number, UnaryOperand, ...Tail]
    readonly typeof: readonly [number, UnaryOperand, ...Tail]
    readonly primitive: readonly [readonly [typeof primitive, RepeatFrom<0, Access>], PowTail, ...Tail]
    readonly name: readonly [typeof identifier, ArrowOrRest]
    readonly array: readonly [readonly [Container<Item>, RepeatFrom<0, Access>], PowTail, ...Tail]
    readonly paren: Paren
}

/**
 * A value: {@link ValueBranches} and an object of members. A `const`
 * thunk whose payload names the thunk, which is what lets a type alias
 * name itself.
 */
export type Value = () => readonly ['const', ValueBranches & {
    readonly object: readonly [readonly [Container<Entry>, RepeatFrom<0, Access>], PowTail, ...Tail]
}]

/**
 * A function's body: {@link ValueBranches} without the object, since
 * `=> {` opens a block in JavaScript — and that block, in which an object
 * is a value again. A group is the other spelling of a body that is an
 * object.
 */
export type Body = () => readonly ['const', ValueBranches & {
    readonly block: Block
}]

/** `(` and what it opens: the one alternative a `(` starts. */
export type Paren = readonly [number, Parenthesized]

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
 * What follows the value a `(` opened: `,`, the names after the first,
 * `)`, `=>` and the body — a named parameter list — or `)` and
 * {@link ArrowOrRest}.
 */
export type AfterValue = {
    readonly list: readonly [number, Option<ParameterNames>, number, number, Body]
    readonly closed: readonly [number, ArrowOrRest]
}

/**
 * What follows a name, or a `( value )`: `=>` and the body, the name or
 * the value being the one parameter — or the rest of the value: the
 * steps, the power and the binary layers, exactly as {@link Value}'s
 * other branches carry them.
 */
export type ArrowOrRest = {
    readonly func: readonly [number, Body]
    readonly rest: readonly [RepeatFrom<0, Access>, PowTail, ...Tail]
}

/** The named parameters after the first: each a name, listed as {@link Items} lists anything. */
export type ParameterNames = () => readonly ['const', {
    readonly rest: readonly [number, typeof identifierName]
    readonly fixed: readonly [typeof identifierName, Option<readonly [number, Option<ParameterNames>]>]
}]

/**
 * A group after its `(`, under a prefix: the value, `)`, the steps the
 * group takes — which are the group's and not the
 * value's, the one thing the parentheses change — and the power it may be
 * raised to, {@link PowTail}. A value's own `(` reads its group through
 * {@link AfterValue} instead, where `=>` may follow the `)`.
 */
export type Group = readonly [Value, number, RepeatFrom<0, Access>, PowTail]

/**
 * `(` and a group: what a `-` may take in parentheses. It is not
 * {@link Paren}, which a function shares — `-(...a) => 1` is a syntax error
 * in JavaScript, and `-((...a) => 1)` is not, the group being the
 * `UnaryExpression` the function is not.
 */
export type ParenGroup = readonly [number, Group]

/**
 * A group after its `(`, without the power {@link Group} itself may carry:
 * everything {@link Group} has but its own {@link PowTail}. `-(1) ** 2` is
 * a syntax error in JavaScript, so {@link UnaryOperand}'s restricted `(`
 * stands on this type rather than {@link Group}'s.
 */
export type GroupOperand = readonly [Value, number, RepeatFrom<0, Access>]

/**
 * `(` and {@link GroupOperand}: what a prefix may take in
 * parentheses, {@link UnaryOperand}'s own `(` branch.
 */
export type ParenGroupOperand = readonly [number, GroupOperand]

/** A statement's terminator: `;`, or nothing. */
export type End = Option<readonly [number]>

/**
 * `{`, the body's statements, its {@link Terminator}, and `}`.
 *
 * A statement is a `const`, {@link constStatement}, the module's own rule
 * — a body binds names the way a module does, and which scope a name lands
 * in is the fold's answer, not the grammar's — or a guard, `if`, `(`, the
 * condition, `)` and a block, this same rule.
 */
export type Block = readonly [number, RepeatFrom<0, Statement>, Terminator, number]

/** A block's statement before its terminator: a `const`, or a guard whose block is a {@link Block}. A thunk, as {@link Value} is, since it names itself through the block. */
export type Statement = () => readonly ['const', {
    readonly const: typeof constStatement
    readonly if: readonly [number, number, Value, number, Block]
}]

/** The statement a block ends with: `return` or `throw`, its value, and {@link End}. */
export type Terminator = {
    readonly return: readonly [number, Value, End]
    readonly throw: readonly [number, Value, End]
}

/**
 * The one rest parameter, when a function has one: `...` and the
 * parameter.
 *
 * The parameter is an {@link identifierName} and not an `identifier`: a
 * binding takes every word a name may be, and the fold refuses the reserved
 * ones by name. The narrower rule would still typecheck — it is assignable
 * to the wider one — while leaving `Children<Func>` unable to hold a tree
 * the grammar produces.
 */
export type Parameter = readonly [number, typeof identifierName]

/** A function's parameter list where it begins with no value: the one rest parameter, or nothing. */
export type Parameters = Option<Parameter>

/**
 * A function after its `(`, which is {@link Paren}'s, where the list is
 * the rest parameter or empty: that list, `)`, `=>`, and the body.
 */
export type Func = readonly [Parameters, number, number, Body]

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
type _FuncParameterIsAName = Assert<Equal<Parameter[1], typeof identifierName>>

/**
 * What a module ends with: `export` and the default, or an exported `const`,
 * the declarations after it and optionally this rule again — or `throw`
 * and its value, in place of the exports.
 */
export type LastStatement = () => readonly ['const', {
    readonly export: readonly [number, {
        readonly default: readonly [number, Value, End]
        readonly named: readonly [typeof constStatement, RepeatFrom<0, typeof constStatement>, Option<Rule>]
    }]
    readonly throw: readonly [number, Value, End]
}]
