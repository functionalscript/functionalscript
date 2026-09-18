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
 * `return` framing a function's block body — which the grammar has to tell
 * apart from an ordinary identifier.
 *
 * The tokenizer emits all seven as `{ kind: 'id' }` with the word in `value`, so
 * a parser layer keyed on `kind` alone would give them the same symbol as any
 * other identifier — and a grammar over that alphabet could not distinguish
 * `export default` from two arbitrary names. They therefore get terminals of
 * their own, which is what a registered alphabet allows: a name's symbol comes
 * from its position in the list, so a name has no length limit.
 */
export type _FramingKeyword = 'import' | 'const' | 'export' | 'default' | 'from' | 'with' | 'return'

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
 * What a `-` takes: a value less the function, JavaScript's unary operand
 * being a `UnaryExpression`, which an arrow function is not — and a group,
 * {@link ParenGroup}, which is one.
 */
export type Unary = () => readonly ['const', {
    readonly neg: readonly [number, typeof trivia, Unary]
    readonly primitive: readonly [readonly [typeof primitive, typeof trivia], RepeatFrom<0, Access>]
    readonly ref: readonly [readonly [typeof identifier, typeof trivia], RepeatFrom<0, Access>]
    readonly array: readonly [Container<Value>, RepeatFrom<0, Access>]
    readonly object: readonly [Container<Member>, RepeatFrom<0, Access>]
    readonly group: ParenGroup
}]

/**
 * A value: a primitive token, a reference, an array of values, or an
 * object of members, each ending with its trivia and each followed by the
 * accesses after it — a `const` thunk whose payload names the thunk, which
 * is what lets a type alias name itself.
 */
export type Value = () => readonly ['const', {
    readonly neg: readonly [number, typeof trivia, Unary]
    readonly primitive: readonly [readonly [typeof primitive, typeof trivia], RepeatFrom<0, Access>]
    readonly ref: readonly [readonly [typeof identifier, typeof trivia], RepeatFrom<0, Access>]
    readonly array: readonly [Container<Value>, RepeatFrom<0, Access>]
    readonly object: readonly [Container<Member>, RepeatFrom<0, Access>]
    readonly paren: Paren
}]

/**
 * A function's body: a value less the object, since `=> {` opens a block in
 * JavaScript — or that block, in which an object is a value again, or a
 * group, which is the other spelling of a body that is an object.
 */
export type Body = () => readonly ['const', {
    readonly neg: readonly [number, typeof trivia, Unary]
    readonly primitive: readonly [readonly [typeof primitive, typeof trivia], RepeatFrom<0, Access>]
    readonly ref: readonly [readonly [typeof identifier, typeof trivia], RepeatFrom<0, Access>]
    readonly array: readonly [Container<Value>, RepeatFrom<0, Access>]
    readonly paren: Paren
    readonly block: Block
}]

/** `(`, trivia, and what it opens: the one alternative a `(` starts. */
export type Paren = readonly [number, typeof trivia, Parenthesized]

/**
 * What a `(` opens: the rest of a function, or a group. Spelled here, as
 * {@link Value} is: the two reach the value rule, which names itself.
 */
export type Parenthesized = {
    readonly func: Func
    readonly group: Group
}

/**
 * A group after its `(`: the value, `)`, the trivia after it, and the steps
 * the group takes — which are the group's and not the value's, the one
 * thing the parentheses change.
 */
export type Group = readonly [Value, number, typeof trivia, RepeatFrom<0, Access>]

/**
 * `(`, trivia and a group: what a `-` may take in parentheses. It is not
 * {@link Paren}, which a function shares — `-(...a) => 1` is a syntax error
 * in JavaScript, and `-((...a) => 1)` is not, the group being the
 * `UnaryExpression` the function is not.
 */
export type ParenGroup = readonly [number, typeof trivia, Group]

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
 * A function after its `(`, which is {@link Paren}'s: `...`, trivia, the
 * parameter, trivia, `)`, same-line trivia, `=>`, trivia, and the body.
 *
 * The parameter is an {@link identifierName} and not an `identifier`: a
 * binding takes every word a name may be, and the fold refuses the reserved
 * ones by name. The narrower rule would still typecheck — it is assignable
 * to the wider one — while leaving `Children<Func>` unable to hold a tree
 * the grammar produces.
 */
export type Func = readonly [number, typeof trivia, typeof identifierName, typeof trivia, number, typeof sameLine, number, typeof trivia, Body]

// Which of the two rules that is, pinned — one guard per direction, since
// neither covers both:
//
// - narrow the *rule* in `./module.f.mjs` and the annotation catches it,
//   `TS2740`, the literal being short the six properties `Func` demands;
// - narrow *this alias* and nothing does. The rule stays assignable to the
//   narrower type, having more properties than it asks for, so `tsc` is
//   silent — measured by removing this line and seeing a clean build.
//
// So this assertion guards the second direction alone, which is the one
// that would leave `Children<Func>` unable to hold a tree the grammar
// produces while every file still compiles.
type _FuncParameterIsAName = Assert<Equal<Func[2], typeof identifierName>>
