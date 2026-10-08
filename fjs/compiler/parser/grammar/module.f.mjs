/**
 * The module grammar over token symbols, spelled LL(1) for
 * `fjs/ebnf/ll1`, which `../syntax/module.f.mjs` reads a module with:
 *
 * ```text
 * module ::= import* const* last eof
 * import ::= 'import' clause 'from' string [ 'with' '{' id ':' string '}' ] end
 * clause ::= named | id [ ',' named ]
 * named  ::= '{' [ items(binding) ] '}'
 * binding ::= id [ 'as' id ]
 * const  ::= 'const' id '=' value end
 * last   ::= 'export' ( 'default' value end | const const* [ last ] )
 *          | 'throw' value end
 * end    ::= [ ';' ]
 * value  ::= '-' unaryOperand tail | '~' unaryOperand tail
 *          | '!' unaryOperand tail | 'typeof' unaryOperand tail
 *          | (primitive | array | object) access* powTail tail
 *          | id arrowOrRest
 *          | '(' (func | value afterValue)
 * body   ::= '-' unaryOperand tail | '~' unaryOperand tail
 *          | '!' unaryOperand tail | 'typeof' unaryOperand tail
 *          | (primitive | array) access* powTail tail
 *          | id arrowOrRest
 *          | '(' (func | value afterValue) | block
 * unary  ::= '-' unaryOperand | '~' unaryOperand | '!' unaryOperand
 *          | 'typeof' unaryOperand
 *          | (primitive | id | array | object) access* powTail
 *          | '(' group
 * unaryOperand ::= '-' unaryOperand | '~' unaryOperand | '!' unaryOperand
 *          | 'typeof' unaryOperand
 *          | (primitive | id | array | object) access*
 *          | '(' groupOperand
 * block  ::= '{' statement* terminator '}'
 * statement ::= const | 'if' '(' value ')' block
 * terminator ::= 'return' value end | 'throw' value end
 * func   ::= [ '...' id ] ')' '=>' body
 * afterValue ::= ',' [ names ] ')' '=>' body | ')' arrowOrRest
 * arrowOrRest ::= '=>' body | access* powTail tail
 * names  ::= '...' id | id [ ',' [ names ] ]
 * group  ::= value ')' access* powTail
 * groupOperand ::= value ')' access*
 * powTail ::= [ '**' unary ]
 * eagerTail ::= { mulOp unary }
 *            { addOp unary <the multiplicative repeat above> }
 *            …six more layers, each repeating over every layer below it
 *            the same way — shift, relational, equality, bitwiseAnd,
 *            bitwiseXor, bitwiseOr, in that order, JavaScript's own
 * logicalAndRound ::= '&&' unary eagerTail
 * logicalOrRound  ::= '||' unary eagerTail { logicalAndRound }
 * nullishRound    ::= '??' unary eagerTail
 * circuitTail ::= [ logicalAndRound { logicalAndRound } { logicalOrRound }
 *                 | logicalOrRound { logicalOrRound }
 *                 | nullishRound { nullishRound } ]
 * conditionalTail ::= [ '?' value ':' value ]
 * tail   ::= eagerTail circuitTail conditionalTail
 * access ::= '.' id | '[' value ']' | '(' [ items(item) ] ')'
 *          | '?.' optionalStep
 * optionalStep ::= id | '[' value ']' | '(' [ items(item) ] ')'
 * array  ::= '[' [ items(item) ] ']'
 * item   ::= '...' value | value
 * object ::= '{' [ items(entry) ] '}'
 * entry  ::= '...' value | member
 * member ::= id [ ':' value ] | string ':' value | '[' string ']' ':' value
 * items(x) ::= x [ ',' [ items(x) ] ]
 * ```
 *
 * A `(` opens two things, so it is read before either: {@link paren} takes
 * the `(` and {@link func} and a value part at the next symbol, `...` or
 * `)` against a value's first. A named parameter list begins with a value
 * too, since one symbol cannot tell `(a) => 1` from `(a).b` — JavaScript
 * itself reads the two apart only past the `)` — so the value is read
 * first and what follows it decides, {@link afterValue}: the grammar's
 * one cover, and the fold checks the value is a name where a parameter
 * was meant.
 *
 * `tail`, the binary-operator suffix — Stage A of
 * [`spec/todo/2340-operators.md`](../../../../spec/todo/2340-operators.md)
 * and Stage B, the lazy operators and the conditional, above it — is
 * spread inline onto every branch that may carry one, rather than
 * wrapping a shared primary the way a textbook precedence ladder would:
 * {@link func}'s body is unbounded, reading everything to its right as its
 * own, so wrapping it in anything a binary layer also wraps would leak
 * that layer's own follow set down into the body and manufacture an LL(1)
 * conflict with no real ambiguity behind it. `unary` is every operand of
 * every layer instead, the leading one and every repeated one alike, and
 * carries no `tail` of its own — see `unary`'s own comment below.
 *
 * Three more things are spelled for one symbol of lookahead, each a
 * conflict the classical grammar this replaced had, measured before the
 * port and recorded in `fjs/compiler/README.md` ("Both grammars are LL(1)"):
 *
 * - **Trivia is no symbol.** Whitespace, newlines and comments are not in
 *   the stream the grammar reads: the tokenizer leaves them out and marks
 *   each token with whether a newline stood before it, `newline` in
 *   `DjsTokenWithMetadata`. So no rule mentions them, none begins with
 *   them — the classical grammar's statement terminator and the module's
 *   final optional `;` both did, a first/first conflict on the trivia
 *   symbols — and the two places JavaScript forbids a line break, before
 *   `=>` and after `return`, are a fact of a token the reader in
 *   `../module.f.mjs` checks rather than a shape the grammar spells.
 * - **A statement ends at `;`, or at nothing.** A newline is never a
 *   symbol a statement ends at, and deciding between a newline and a `;`
 *   reached through newlines took unbounded lookahead while it was one.
 *   So {@link end} is optional and the grammar looks no further; whether
 *   the token that follows an omitted `;` began a line — JavaScript's own
 *   rule for inserting one — is the same fact of the token, and the
 *   reader's to check.
 * - **A list is right-recursive.** After an item and its comma, one
 *   symbol of lookahead says whether an item or the closing bracket
 *   follows, so a trailing comma is a comma nothing follows; the classical
 *   grammar rested it on a failed repetition round rewinding.
 *
 * The alphabet is {@link _ordinaryTokenNames}: one name per token kind,
 * trivia having none, since it is not in the stream,
 * and the framing keywords with names of their own, since the
 * tokenizer emits them as identifiers — encoded by `fjs/ebnf/token_symbol`;
 * `eof` has none, since the backend synthesizes the end of input. A symbol
 * is a rule of one symbol, so a terminal is the symbol a token is encoded
 * to and nothing else.
 *
 * @module
 *
 * @import { Meta } from '../../../ebnf/ast/types.ts'
 * @import { Rule, Variant } from '../../../ebnf/types.ts'
 * @import { DjsTokenWithMetadata } from '../../tokenizer/types.ts'
 * @import { BinaryTag } from '../../ast/types.ts'
 * @import { StringMap } from '../../../types/object/types.ts'
 * @import { Access, AfterValue, ArrowOrRest, Block, Body, CircuitTail, ConditionalTail, EagerTail, End, Func, Group, GroupOperand, Item, Items, LastStatement, Member, Entry, OptionalStep, ParameterNames, Parameters, Paren, ParenGroup, ParenGroupOperand, Parenthesized, PowTail, Statement, Tail, Terminator, Unary, UnaryOperand, Value, ValueBranches } from './types.ts'
 */

import { assert } from '../../../asserts/module.f.mjs'
import { eof, option, repeatFrom0 } from '../../../ebnf/module.f.mjs'
import { encoding } from '../../../ebnf/token_symbol/module.f.mjs'
import { literalWords } from '../../../js/keywords/module.f.mjs'
import { _djsTokenKinds } from '../../tokenizer/module.f.mjs'
import { definedEntries } from '../../../types/object/module.f.mjs'

const { fromEntries } = Object

/**
 * The token kinds, every `DjsToken` kind but `eof`: the tokenizer's
 * physical end-of-input token is split off the stream before any name is
 * mapped, and the backend synthesizes its own logical one. The kinds are
 * the tokenizer's own list, {@link _djsTokenKinds}, rather than a copy of it.
 *
 * The names are the *token* vocabulary, not the tokenizer grammar's tag
 * vocabulary: only twelve punctuators survive into `DjsToken`, so the JS
 * operator set the tokenizer recognizes is far larger than what reaches
 * this layer.
 *
 * The `_…AreComplete` assertions in `./types.ts` check both halves
 * against `DjsToken` and `_FramingKeyword` at compile time, so a kind or
 * keyword added there breaks the build rather than going unrepresented.
 * Exported with a leading `_` for that linkage — the export is not API.
 */
export const _tokenKindNames = _djsTokenKinds.filter(kind => kind !== 'eof')

/**
 * The keywords a rule below *requires* in some position, which the
 * tokenizer emits as `id` tokens carrying the word in `value`. Kept as its
 * own list because {@link symbolOf} has to recognize exactly these values,
 * not merely encode them. Six frame a module, `return` and `throw` end a
 * function's block body — `throw` a module too — `if` opens a guard in
 * one, and `as` introduces an import alias.
 *
 * **A grammar over this alphabet owes them an identifier rule.** Once each
 * carries its own symbol, a rule whose identifier terminal is the bare `id`
 * symbol rejects every one of them, which is what {@link identifier} is
 * for: the union of `id` and the framing keywords. Which words a position may
 * hold is the fold's to say, since it is a property of the word — JavaScript
 * reserves six while `from` and `as` are ordinary, and it lets every reserved
 * word stand as a key or after `.`, so `{ default: 3 }`, `{ return: 3 }`
 * and `a.with` parse and `const export = 1;` is refused by the fold, as
 * `const if = 1;` is.
 *
 * Giving a word its own symbol narrows where it is *required*, never where
 * it is *allowed* — with one exception. `typeof` is required where a value
 * begins, as the prefix of {@link unary}, so it alone is kept out of
 * {@link identifier}: a rule admitting it as a reference there would open
 * two branches on one symbol, which `fjs/ebnf/ll1` refuses, and a
 * reference cannot be a reserved word anyway. {@link identifierName} still
 * admits it, so `{ typeof: 1 }` and `a.typeof` are members as in JavaScript,
 * and a binding takes that wider rule too, so `const typeof = 1;` still
 * reaches the fold and is refused as a `reserved word`, as `const if = 1;` is.
 */
export const _framingKeywords = /** @type {const} */ (['import', 'const', 'export', 'default', 'from', 'with', 'return', 'throw', 'if', 'as', 'typeof'])

/**
 * The complete alphabet: one name per `DjsToken` kind except `eof`, plus
 * one per keyword above. No keyword collides with a kind, so the two
 * lists concatenate without a name being registered twice — which
 * `encoding` would reject anyway.
 */
export const _ordinaryTokenNames = [..._tokenKindNames, ..._framingKeywords]

const alphabet = encoding(_ordinaryTokenNames)

/** The symbol of a token name: what a token is encoded to, and the terminal that names it. */
export const sym = alphabet.encode

/**
 * One token as the parser's input: the symbol of its kind — of its word,
 * for a keyword with its own symbol — with the whole token as metadata, so that a fold
 * above still has its value and its position.
 *
 * `eof` has no symbol: a stream reaching here has had it split off, and
 * one that has not is a caller's mistake, not bad input.
 *
 * @type {(t: DjsTokenWithMetadata) => Meta<DjsTokenWithMetadata>}
 */
export const symbolOf = t => {
    const { token } = t
    const keyword = token.kind === 'id' ? _framingKeywords.find(k => k === token.value) : undefined
    const name = keyword ?? token.kind
    assert(name !== 'eof', ['eof token reached the parser alphabet', t])
    return { symbol: sym(name), meta: t }
}

/**
 * Every word that may stand where an identifier is expected: `id`, and the
 * keywords with symbols of their own, which arrive as `id` tokens too.
 * Whether the word is reserved there is the fold's to check, as it is for
 * every other keyword.
 */
export const identifier = /** @type {const} */ ({
    id: sym('id'),
    import: sym('import'),
    const: sym('const'),
    export: sym('export'),
    default: sym('default'),
    from: sym('from'),
    with: sym('with'),
    return: sym('return'),
    throw: sym('throw'),
    if: sym('if'),
    as: sym('as'),
})

/**
 * The token kinds that are a whole value: the six words that denote one,
 * which are `fjs/js/keywords`' {@link literalWords} rather than a copy of
 * them, and the three literals. {@link primitive} is a variant over exactly
 * these, and {@link identifierName} admits the six words as names; the
 * `_ValueKindsAre…` assertions in `./types.ts` pin both to this list, and
 * `../syntax/proof.f.mjs` folds a value of every kind through the switch
 * that converts them. Exported with a leading `_` for that linkage — the
 * export is not API.
 */
export const _valueKinds = /** @type {const} */ ([...literalWords, 'number', 'string', 'bigint'])

/**
 * Every word that may *name* something — a property, or a binding — which
 * is {@link identifier} and the six words that denote a value.
 *
 * ECMAScript draws the same line and this follows it: a property is named
 * by an `IdentifierName`, which admits every reserved word, so `{ NaN: 1 }`
 * and `a.NaN` are JavaScript and mean the string `"NaN"`, while a reference
 * is an `IdentifierReference`, which admits none of them — `typeof` among
 * them, the one framing keyword {@link identifier} lacks, for the reason
 * its list gives. A binding is an
 * ECMAScript `BindingIdentifier`, narrower still; it takes this wider rule
 * here so that `const NaN = 1;` reaches the fold and is refused as a
 * `reserved word`, rather than dying at the token with `unexpected token`.
 *
 */
export const identifierName = /** @type {const} */ ({
    ...identifier,
    typeof: sym('typeof'),
    null: sym('null'),
    true: sym('true'),
    false: sym('false'),
    undefined: sym('undefined'),
    NaN: sym('NaN'),
    Infinity: sym('Infinity'),
})

/** A value that is one token: one branch per kind in {@link _valueKinds}. */
export const primitive = /** @type {const} */ ({
    null: sym('null'),
    true: sym('true'),
    false: sym('false'),
    undefined: sym('undefined'),
    NaN: sym('NaN'),
    Infinity: sym('Infinity'),
    number: sym('number'),
    string: sym('string'),
    bigint: sym('bigint'),
})

/**
 * A comma-separated list of items, at least one, a trailing comma allowed.
 *
 * @type {<const I extends Rule>(item: I) => Items<I>}
 */
export const items = item => {
    /** @type {Items<typeof item>} */
    const list = () => ['const', [item, option([sym(','), option(list)])]]
    return list
}

/**
 * A value: {@link valueBranches}, and an object. A `const` thunk whose
 * payload names the thunk, which is what lets a type alias name itself.
 *
 * Any value takes accesses, as any expression does in JavaScript:
 * `[1].length`, `"ab"[0]`, `{ a: 1 }.a`. `1 .x` parses here too, with a
 * space since `1.x` is one number and a stray word in JavaScript. Stages A
 * and B of
 * [`spec/todo/2340-operators.md`](../../../../spec/todo/2340-operators.md):
 * arithmetic (`+ - * / % **`, and unary `-`), strict comparison
 * (`=== !== > >= < <=`), bitwise (`& | ^ ~ << >> >>>`), the lazy operators
 * (`&& || ??`) and the conditional (`?:`). `==`/`!=` stay refused, and the
 * comma stage waits on `tail`'s current top, the conditional.
 *
 * Declared before {@link access}, which an index embeds it in: `[ value ]`
 * holds any value, so that a key computed at run time, `a[Number(i)]`, is
 * read as JavaScript reads it, and what a key may be — a string or a
 * number literal, or the conversion
 * ([spec: property access](../../../../spec/README.md#property-access)) —
 * is the fold's to check, as the name after `.` is. The rule itself, and
 * no thunk over it: a second rule over the same branches would be a second
 * copy of the whole value grammar in every parser that reaches an index.
 * A thunk, it names {@link valueBranches} and {@link tail}, declared
 * after it, only when a parser forces it.
 *
 * @type {Value}
 */
export const value = () => ['const', {
    ...valueBranches(),
    object: [[object, accesses], powTail, ...tail],
}]

/**
 * A call's arguments: the items an array holds, {@link values}, reached
 * through a thunk.
 *
 * This is where the grammar's cycle is broken a second time — a value takes
 * steps, a step may be a call, and a call holds values, so `access` would
 * have to name `values` before it is declared. A rule of its own rather than
 * a thunk over the value rule, because what a list embeds has to be the
 * `value` rule itself: the rewrite set is keyed by rule, so a wrapper in the
 * item's place would leave each argument unmapped.
 *
 * @type {() => ReturnType<Items<Item>>}
 */
export const callArguments = () => values()

/**
 * What follows `?.`: the three steps a value takes, each spelled as it is
 * after a value, less the `.` a property's own spelling begins with — the
 * `?.` has it. One symbol decides between them, a word, `[` or `(`, so an
 * optional step is read in two: the `?.` and then this.
 *
 * @type {OptionalStep}
 */
export const optionalStep = /** @type {OptionalStep} */ ({
    property: identifierName,
    index: [sym('['), value, sym(']')],
    call: [sym('('), option(callArguments), sym(')')],
})

/**
 * One step after a value: a property access, `.name` with the name any
 * identifier or `[key]` with the key a value, {@link value}, or a call, `(a, b)` with
 * its arguments any values. What a property's two spellings may name is the
 * fold's to check, since the name is a word the grammar does not see.
 *
 * Four symbols decide between them — `.`, `[`, `(` and `?.` — and none of
 * them follows a value any other way, so the step a value takes is read in
 * one. `f(1)(2)` and `a.b(1)[0]` are steps upon steps, as `a.b[0]` is: what
 * a step applies to is everything written before it. The fourth is the
 * optional step, `?.` and then {@link optionalStep}: the same three steps,
 * guarded.
 */
export const access = /** @type {Access} */ ({
    property: [sym('.'), identifierName],
    index: [sym('['), value, sym(']')],
    call: [sym('('), option(callArguments), sym(')')],
    optional: [sym('?.'), optionalStep],
})

/** The accesses after a value, `a.b[0]`, none or more. */
const accesses = repeatFrom0(access)

/** A primitive value, then its accesses. */
const primitiveValue = /** @type {const} */ ([primitive, accesses])

/** A reference, then its accesses. */
const reference = /** @type {const} */ ([identifier, accesses])

/** `*`, `/`, `%` — the binary layer directly above {@link unary}. */
const multiplicativeTags = /** @type {const} */ ({ mul: '*', div: '/', mod: '%' })

/**
 * `+`, `-` — above {@link multiplicativeTags}. The `-` here is subtraction,
 * distinct from the `neg` prefix {@link unary} already owns: the two share
 * a token and nothing else, one an operator of two operands and the other
 * of one, told apart by which branch of the grammar reads them.
 */
const additiveTags = /** @type {const} */ ({ add: '+', sub: '-' })

/** `<<`, `>>`, `>>>` — above {@link additiveTags}. */
const shiftTags = /** @type {const} */ ({ left: '<<', right: '>>', unsigned: '>>>' })

/** `<`, `<=`, `>`, `>=` — above {@link shiftTags}. */
const relationalTags = /** @type {const} */ ({ lt: '<', le: '<=', gt: '>', ge: '>=' })

/** `===`, `!==` — above {@link relationalTags}; `==`/`!=` are not this language's, per `spec/todo/2340-operators.md`. */
const equalityTags = /** @type {const} */ ({ eq: '===', ne: '!==' })

/** `&` — above {@link equalityTags}. */
const bitwiseAndTags = /** @type {const} */ ({ and: '&' })

/** `^` — above {@link bitwiseAndTags}. */
const bitwiseXorTags = /** @type {const} */ ({ xor: '^' })

/** `|` — above {@link bitwiseXorTags}, the eager ladder's own top. */
const bitwiseOrTags = /** @type {const} */ ({ or: '|' })

/**
 * `&&`, `||`, `??` — the short-circuit level above {@link bitwiseOrTags},
 * Stage B of
 * [`spec/todo/2340-operators.md`](../../../../spec/todo/2340-operators.md).
 * Each is a tagged choice of one branch, as every layer's operator is,
 * because the reader in `../syntax/module.f.mjs` looks a round's operator up by
 * that tag; three choices rather than one of three branches, since which
 * of them opens a chain decides what may follow it — see
 * {@link circuitTail}.
 */
const logicalAndTags = /** @type {const} */ ({ logicalAnd: '&&' })

/** `||` — beside {@link logicalAndTags}, and above it in precedence. */
const logicalOrTags = /** @type {const} */ ({ logicalOr: '||' })

/** `??` — beside {@link logicalAndTags} and {@link logicalOrTags}, and mixing with neither. */
const nullishTags = /** @type {const} */ ({ nullish: '??' })

/**
 * Every binary layer's rounds keyed by a name none of the other layers
 * use, read back to the operator's tag — which is also the token the round
 * opens with, so {@link opOf} makes each layer's grammar from its own
 * record, and this one merged map serves `../syntax/module.f.mjs` a round
 * from any layer with a plain lookup. `**` is not here: it is
 * {@link powTail}'s, no layer's round. The lookup is by a name read at
 * run time, so it is typed as one that may miss, and the reader refuses a
 * name that does rather than build a node without a tag.
 *
 * @type {StringMap<Exclude<BinaryTag, '**'>>}
 */
export const binaryOpTag = {
    ...multiplicativeTags,
    ...additiveTags,
    ...shiftTags,
    ...relationalTags,
    ...equalityTags,
    ...bitwiseAndTags,
    ...bitwiseXorTags,
    ...bitwiseOrTags,
    ...logicalAndTags,
    ...logicalOrTags,
    ...nullishTags,
}

/**
 * One layer's operator: a choice of one branch per operator, keyed by its
 * name and matching the token its tag names.
 *
 * @type {(tags: StringMap<Exclude<BinaryTag, '**'>>) => Variant}
 */
const opOf = tags => fromEntries(definedEntries(tags).map(([name, tag]) => [name, sym(tag)]))

// Each layer's operator, its record's names over its record's tokens.
const multiplicativeOp = opOf(multiplicativeTags)
const additiveOp = opOf(additiveTags)
const shiftOp = opOf(shiftTags)
const relationalOp = opOf(relationalTags)
const equalityOp = opOf(equalityTags)
const bitwiseAndOp = opOf(bitwiseAndTags)
const bitwiseXorOp = opOf(bitwiseXorTags)
const bitwiseOrOp = opOf(bitwiseOrTags)
const logicalAndOp = opOf(logicalAndTags)
const logicalOrOp = opOf(logicalOrTags)
const nullishOp = opOf(nullishTags)

/**
 * A function's parameter list where it begins with no value: the one rest
 * parameter, `(...a)`, or nothing, `()`. One symbol decides between them —
 * `...` opens the parameter and `)` closes an empty list, and a list is
 * written nowhere else, so neither reaches here any other way.
 *
 * It is what tells this function from everything else past {@link paren}'s
 * `(` as well: a `...` or a `)` is this rule, and a named list and a group
 * both start with a value, the two sets sharing nothing. The named list is
 * {@link afterValue}'s.
 *
 * @type {Parameters}
 */
export const parameters = option([sym('...'), identifierName])

/**
 * The named parameters after the first and its comma: `b, c` in
 * `(a, b, c)`, none in `(a,)`. Each is a name, a trailing comma allowed as
 * {@link items} allows one everywhere. The first
 * parameter is not this rule's: it is read as a value, and
 * {@link afterValue} has why.
 *
 * @type {ParameterNames}
 */
export const parameterNames = () => ['const', {
    rest: [sym('...'), identifierName],
    fixed: [identifierName, option([sym(','), option(parameterNames)])],
}]

/**
 * What a prefix takes: every value but a function. JavaScript's
 * unary operand is a `UnaryExpression`, which an arrow function is not —
 * `-(...a) => 1` and `~(...a) => 1` are syntax errors there, so they are
 * here — and each branch is right-recursive, so `- -1` is a negation of a
 * negation, `~ ~1` a bitwise-not of one and `!!1` a logical-not of one.
 * `--1` and `~~1` are not either's own token, and `!!1` is none: `--` is
 * the decrement token the language has no rule for, and `~~1` and `!!1`
 * are two prefixes each, not one operator, the tokenizer reading `~` and
 * `~`, or `!` and `!`, where it reads `-` and `-` for the other.
 *
 * A group is an operand, {@link parenGroup}, and it is how a function
 * reaches a prefix at all: `-((...a) => 1)` negates one where
 * `-(...a) => 1` cannot be written. So the branch is that rule and not
 * {@link paren}, which a function shares — taking the `(` alternative
 * whole would admit the spelling JavaScript refuses.
 *
 * Every other alternative may be raised to a power, {@link powTail} —
 * `2 ** 2`, a primary with nothing before it, is fine — but neither prefix
 * reaches `powTail` itself: each recurses into {@link unaryOperand}
 * instead, whose own comment has why.
 *
 * `unary` is also every binary operator's own operand, both the leading
 * one and every repeated one after an operator token — never {@link value}
 * or {@link body} themselves. A function's body is unbounded, reading
 * everything to the right of `=>` as its own, so nothing may follow one
 * without an extra group around it; embedding {@link paren} — the
 * function-or-group choice — anywhere a binary layer wraps would leak that
 * layer's own follow set down into the function's body and manufacture an
 * LL(1) conflict `fjs/ebnf/ll1` has no way to resolve, even though no
 * parse is actually ambiguous: a greedy reader never needs the choice the
 * checker flags. So a binary operand is always this rule, whose own `(`
 * is {@link parenGroup} and reaches no function, and {@link func} stands
 * only where {@link value}/{@link body} put it directly — the leading
 * alternative of a whole value, never a repeated operand of one.
 *
 * @type {Unary}
 */
export const unary = () => ['const', {
    neg: [sym('-'), unaryOperand],
    bitnot: [sym('~'), unaryOperand],
    not: [sym('!'), unaryOperand],
    typeof: [sym('typeof'), unaryOperand],
    primitive: [primitiveValue, powTail],
    ref: [reference, powTail],
    array: [[array, accesses], powTail],
    object: [[object, accesses], powTail],
    group: parenGroup,
}]

/**
 * `**`'s right operand, when a primary, a group, or a prefix's own operand
 * is raised to a power: right-associative, so `2 ** 3 ** 2` is
 * `2 ** (3 ** 2)`, and reaching back into {@link unary} — not stopping at
 * a bare primary — is how `2 ** -2` and `2 ** ~2` stand without
 * parentheses: `unary`'s own prefixes recurse into {@link unaryOperand},
 * which is what keeps `2 ** -2 ** 2` a syntax error exactly as it is in
 * JavaScript, the inner `-2 ** 2` refused the same way the outer would be.
 *
 * @type {PowTail}
 */
const powTail = option([sym('**'), unary])

/**
 * What a prefix takes: every alternative {@link unary} has — a
 * primitive, a reference, an array, an object, a group, or a further
 * prefix — but none of them carries {@link powTail}, here or through any
 * depth of recursion.
 *
 * JavaScript refuses `**` immediately after a unary-prefixed operand,
 * full stop, at any depth: `- 2 ** 2`, `- -2 ** 2` and `- (2) ** 2` are
 * all syntax errors, because each of `-2`, `- -2` and `-(2)` is a
 * `UnaryExpression`, and `**`'s own left operand — an `UpdateExpression` —
 * may never be one. Only `(-2) ** 2` and `-(2 ** 2)` write either reading:
 * parentheses that move the `**` to where it no longer immediately
 * follows the prefix, one wrapping the negation and the other the power.
 *
 * So {@link unary}'s own prefix branches, and {@link value}'s and
 * {@link body}'s, all reach this rule for their operand rather than
 * `unary` itself — and this rule reaches itself, not `unary`, for a
 * nested prefix's own operand, `- -2 ** 2` refused the same way `- 2 **
 * 2` is rather than only the outer prefix carrying the restriction.
 *
 * The four leaves are each still wrapped one tuple deep, `[primitiveValue]`
 * rather than `primitiveValue` bare, matching {@link unary}'s own
 * `[primitiveValue, powTail]` at the same depth minus the slot `powTail`
 * held — `../syntax/module.f.mjs`'s reader shares one function, `baseOf`, between
 * both rules, and that depth is what lets it.
 *
 * @type {UnaryOperand}
 */
export const unaryOperand = () => ['const', {
    neg: [sym('-'), unaryOperand],
    bitnot: [sym('~'), unaryOperand],
    not: [sym('!'), unaryOperand],
    typeof: [sym('typeof'), unaryOperand],
    primitive: [primitiveValue],
    ref: [reference],
    array: [[array, accesses]],
    object: [[object, accesses]],
    group: parenGroupOperand,
}]

/**
 * `*`, `/`, `%` — the binary layer directly above {@link unary}: zero or
 * more `(op, operand)` pairs, the operand always {@link unary}, never
 * {@link value}/{@link body} themselves — see {@link unary}'s own comment
 * for why. Threaded inline as a suffix on every branch of `value`/`body`
 * that may be followed by one, rather than wrapping a shared primary as a
 * unit, which is what let {@link func}'s body leak a wide follow set in
 * the first place.
 */
const multiplicativeTail = repeatFrom0([multiplicativeOp, unary])

/**
 * `+`, `-` — above {@link multiplicativeTail}. Each repeated operand is a
 * {@link unary} followed by its own {@link multiplicativeTail}, so `1 + 2
 * * 3` nests as `1 + (2 * 3)` rather than `(1 + 2) * 3`.
 */
const additiveTail = repeatFrom0([additiveOp, unary, multiplicativeTail])

/** `<<`, `>>`, `>>>` — above {@link additiveTail}. */
const shiftTail = repeatFrom0([shiftOp, unary, multiplicativeTail, additiveTail])

/** `<`, `<=`, `>`, `>=` — above {@link shiftTail}. */
const relationalTail = repeatFrom0([relationalOp, unary, multiplicativeTail, additiveTail, shiftTail])

/** `===`, `!==` — above {@link relationalTail}; `==`/`!=` are not this language's, per `spec/todo/2340-operators.md`. */
const equalityTail = repeatFrom0([equalityOp, unary, multiplicativeTail, additiveTail, shiftTail, relationalTail])

/** `&` — above {@link equalityTail}. */
const bitwiseAndTail = repeatFrom0([bitwiseAndOp, unary, multiplicativeTail, additiveTail, shiftTail, relationalTail, equalityTail])

/** `^` — above {@link bitwiseAndTail}. */
const bitwiseXorTail = repeatFrom0([bitwiseXorOp, unary, multiplicativeTail, additiveTail, shiftTail, relationalTail, equalityTail, bitwiseAndTail])

/** `|` — above {@link bitwiseXorTail}, the eager ladder's own top. */
const bitwiseOrTail = repeatFrom0([bitwiseOrOp, unary, multiplicativeTail, additiveTail, shiftTail, relationalTail, equalityTail, bitwiseAndTail, bitwiseXorTail])

/**
 * The eager binary-operator suffix, {@link multiplicativeTail} through
 * {@link bitwiseOrTail}: every layer whose operands are all established,
 * and so the first part of {@link tail}, and every lazy operator's own
 * operand — `unary` followed by these eight lists, which is what a
 * `bitwiseOr`-level expression is.
 *
 * Exported for the reader in `../syntax/module.f.mjs`, which splits a value's
 * whole {@link tail} at this list's length: the eager layers are one shape,
 * a repeat of rounds each, and the two positions after them another.
 *
 * @type {EagerTail}
 */
export const eagerTail = [
    multiplicativeTail, additiveTail, shiftTail, relationalTail,
    equalityTail, bitwiseAndTail, bitwiseXorTail, bitwiseOrTail,
]

/**
 * One round of the `&&` layer: `&& unary <every eager tail>`, the same
 * shape as {@link bitwiseOrTail}'s round one layer up, so `a && b | c` is
 * `a && (b | c)`.
 */
const logicalAndRound = /** @type {const} */ ([logicalAndOp, unary, ...eagerTail])

/** The `&&` rounds after the first, `a && b && c` folding left as every layer does. */
const logicalAndTail = repeatFrom0(logicalAndRound)

/**
 * One round of the `||` layer: its operand carries {@link logicalAndTail}
 * as a layer's round carries every layer below it, so `a || b && c` is
 * `a || (b && c)`.
 */
const logicalOrRound = /** @type {const} */ ([logicalOrOp, unary, ...eagerTail, logicalAndTail])

/** The `||` rounds after the first. */
const logicalOrTail = repeatFrom0(logicalOrRound)

/** One round of the `??` layer: `?? unary <every eager tail>`, an operand no `&&` or `||` may enter. */
const nullishRound = /** @type {const} */ ([nullishOp, unary, ...eagerTail])

/** The `??` rounds after the first. */
const nullishTail = repeatFrom0(nullishRound)

/**
 * The short-circuit level, above {@link eagerTail}: nothing, or a chain the
 * first operator commits — `&&` and `||` to the logical ladder, `&&` below
 * `||` as in JavaScript, and `??` to a chain of its own.
 *
 * JavaScript keeps `??` apart from `&&`/`||` at one nesting — `a ?? b || c`
 * and `a && b ?? c` are syntax errors, not precedence questions — by
 * giving the two their own productions, `LogicalORExpression` beside
 * `CoalesceExpression`. Spelled as that choice, the two alternatives both
 * open with the same operand, a first/first conflict `fjs/ebnf/ll1`
 * refuses before any input; so the operand is read once, as the branch's
 * own, and the choice is made at the operator after it, one symbol wide.
 * Once made, the branch's continuation has no round for the other chain's
 * token, which is where `a ?? b || c` fails: at the `||`, refused by the
 * grammar's shape and not by a check after it. Parentheses admit either
 * mix, `(a ?? b) || c`, as they do in JavaScript.
 *
 * The three branches are each a round and the repeat lists after it —
 * the `&&` branch's first round is a {@link logicalAndTail} round and the
 * `||` branch's a {@link logicalOrTail} round — so the reader folds a
 * branch as it folds a layer: the round onto the value before it, and the
 * lists onto that.
 *
 * @type {CircuitTail}
 */
export const circuitTail = option({
    logicalAnd: [logicalAndRound, logicalAndTail, logicalOrTail],
    logicalOr: [logicalOrRound, logicalOrTail],
    nullish: [nullishRound, nullishTail],
})

/**
 * The branches {@link value} and {@link body} both start with: a
 * prefix (`-`, `~`, `!` or `typeof`), a primitive token, a name, an array,
 * or `(` — the choice
 * between a function and a group, {@link parenthesized} — each ending
 * with its own {@link tail}, the binary-operator suffix, except a
 * function: nothing may follow one unparenthesized, `=>` reading
 * everything to its right as the body, so {@link func} stands bare where
 * the others carry {@link tail}, and a name is a reference or the one
 * parameter of `a => …`, which {@link arrowOrRest} tells apart after it.
 *
 * A thunk, as the rules are: the branches name {@link tail}, which is
 * declared after them, so they are built only when a rule is forced,
 * after every binding in this module exists.
 *
 * @type {() => ValueBranches}
 */
const valueBranches = () => ({
    neg: [sym('-'), unaryOperand, ...tail],
    bitnot: [sym('~'), unaryOperand, ...tail],
    not: [sym('!'), unaryOperand, ...tail],
    typeof: [sym('typeof'), unaryOperand, ...tail],
    primitive: [primitiveValue, powTail, ...tail],
    name: [identifier, arrowOrRest],
    array: [[array, accesses], powTail, ...tail],
    paren,
})

/**
 * A function's body: {@link valueBranches} without the object — after
 * `=>` JavaScript reads `{` as a block, never as an object, so the
 * spelling is refused rather than read another way — and that block,
 * {@link block}, in which an object is an ordinary value again. A group
 * is the other spelling of a body that is an object,
 * `(...a) => ({ x: 1 })`.
 *
 * `{` decides the block in one symbol, since no other branch starts with
 * it — and after a prefix it opens an object again, the prefix putting
 * what follows it in expression position, which is why those branches are
 * {@link unary} rather than this rule. `(` decides the function or the
 * group, {@link parenthesized}.
 *
 * @type {Body}
 */
export const body = () => ['const', { ...valueBranches(), block }]

/**
 * The conditional, above {@link circuitTail} and the top of {@link tail}:
 * nothing, or `? value : value`, each arm a whole {@link value} —
 * JavaScript's arms are `AssignmentExpression`s, and this language, having
 * no assignment, takes the ladder's own top as the nearest — so an arm may
 * be a function, a further conditional or anything else a value is, and
 * nested conditionals associate to the right through the arms' own
 * recursion, `a ? b : c ? d : e` being `a ? b : (c ? d : e)`, with no
 * repeat construct.
 *
 * `?` is a token of its own beside `??` and `?.`, so the choice stays one
 * symbol wide, and `:` follows a value here as it precedes one in a
 * member — so it follows a function's body too, an arm being a value, and
 * `fjs/ebnf/ll1` finds no conflict in that: nothing a body may continue
 * with begins with `:`, so `a ? () => 1 : 2` is the function and then the
 * else arm, as JavaScript reads it, the body ending where `:` cannot
 * continue it.
 *
 * Declared after {@link value} and {@link body}, which name it through
 * {@link tail}: an arm names the `value` binding directly, so the binding
 * has to exist here, where the two rules reach `tail` only when called,
 * after every rule in this module is bound.
 *
 * @type {ConditionalTail}
 */
export const conditionalTail = option([sym('?'), value, sym(':'), value])

/**
 * The whole operator suffix, {@link eagerTail} and then the two lazy
 * positions above it, {@link circuitTail} and {@link conditionalTail},
 * spread onto every branch of {@link value} and {@link body} that may
 * carry one.
 *
 * @type {Tail}
 */
const tail = [...eagerTail, circuitTail, conditionalTail]

/**
 * A function after its `(`, where the list is the rest parameter or empty:
 * that list, the `)`, `=>` and the body. JavaScript requires the `=>` on
 * the line of the `)`, which is a fact of the `=>` token the reader in
 * `../module.f.mjs` checks, trivia being no symbol here. The rest
 * parameter is the arguments array, and the body names it
 * and nothing outside — which names it may use is the fold's to say, since
 * a name is a word the grammar does not see. A function with no parameter
 * names nothing at all, its arguments included.
 *
 * The `(` is {@link paren}'s, since a group and a named list open with
 * the same symbol. Nothing follows a function directly — see
 * {@link unary}'s own comment — so unlike every other branch of
 * {@link value}/{@link body}, this one carries no {@link tail}.
 *
 * @type {Func}
 */
export const func = [parameters, sym(')'), sym('=>'), body]

/**
 * What follows a name, or a `( value )`: `=>` — the name, or the value in
 * the parentheses, being the one parameter — and the body; or the rest of
 * the value the name or the group is: the steps, the power and the binary
 * layers above, exactly as every other branch of {@link value} carries
 * them.
 *
 * `=>` decides it in one symbol. JavaScript's `[no LineTerminator here]`
 * before `=>` is no shape of this rule: `a\n.b` and `a\n=> 1` are read
 * alike, and the reader in `../module.f.mjs` refuses the second at the
 * `=>`, whose `newline` says a line break stood before it, as JavaScript
 * refuses it.
 *
 * @type {ArrowOrRest}
 */
export const arrowOrRest = {
    func: [sym('=>'), body],
    rest: [accesses, powTail, ...tail],
}

/**
 * What follows the value a `(` opened: `,` — the value is the first of a
 * named parameter list, and the names after it, the `)`, `=>` on the same
 * line and the body follow — or `)`, after which {@link arrowOrRest} tells
 * the one-parameter function `(a) => 1` from the group `(a)`.
 *
 * The first parameter is read as a value because one symbol cannot tell it
 * from a group's: `(a) => 1` and `(a).b` agree up to the `)`, and
 * JavaScript itself reads the two apart only past it. So the grammar reads
 * a value, the way JavaScript's own cover grammar does, and the fold
 * checks it is a plain name where the `=>` or the `,` says a parameter was
 * meant — a reference, not grouped again, `((a)) => 1` being a syntax
 * error in JavaScript. The names after the comma are
 * {@link parameterNames}, read as names outright: nothing but a list
 * continues with a comma there.
 *
 * @type {AfterValue}
 */
export const afterValue = {
    list: [sym(','), option(parameterNames), sym(')'), sym('=>'), body],
    closed: [sym(')'), arrowOrRest],
}

/**
 * A group after its `(`: any value, the `)`, and the steps after it. A
 * group denotes the value it holds and nothing more — `(x)` is `x`, the
 * graph and its sharing as if the parentheses were not written, which is
 * what JavaScript means by them — so it makes no node of its own and there
 * is no canonical form to choose.
 *
 * A group takes steps as any value does, `([1]).length`, and a step reads
 * the value inside: parentheses are not a boundary the fold or the lowering
 * can see, so `(a.b)(c)` is the method call `a.b(c)` is — JavaScript keeps
 * the property reference through them, and only the comma operator detaches
 * a receiver.
 *
 * The value inside is the whole value rule, `{` included: a group is not
 * the place a block may start, so `({ x: 1 })` is the object it looks
 * like.
 *
 * The steps after the `)` may raise the whole group to a power,
 * {@link powTail} — `(1 + 2) ** 2`. This rule is {@link unary}'s
 * restricted `(`; {@link value}'s full one reads the same group through
 * {@link afterValue} and {@link arrowOrRest}, where `=>` may follow the
 * `)` and {@link tail}, the binary-operator suffix, follows a group.
 *
 * @type {Group}
 */
export const group = [value, sym(')'), accesses, powTail]

/**
 * What a `(` opens: the rest of a function whose list is the rest
 * parameter or empty, or a value and what follows it, {@link afterValue} —
 * a group with {@link tail}, the binary-operator suffix, `(1 + 2) * 3`, or
 * a named parameter list. `...` and `)` decide the function in one symbol —
 * no value begins with either — so the branches share the `(` and the
 * grammar never looks past the `)`.
 *
 * @type {Parenthesized}
 */
export const parenthesized = { func, value: [value, afterValue] }

/**
 * A `(` and what it opens: the `(`-alternative of {@link value} and of
 * {@link body} both, since a function and a group stand wherever a value
 * does.
 *
 * @type {Paren}
 */
export const paren = [sym('('), parenthesized]

/**
 * A `(` and the group it opens, with no function among the alternatives:
 * {@link unary}'s `(` branch. A group after a `-` takes its own steps, so
 * `-(1).x` is the negation of the access, as JavaScript reads it.
 *
 * @type {ParenGroup}
 */
export const parenGroup = [sym('('), group]

/**
 * A group after its `(`, without the power {@link group} itself may
 * carry: the value, `)` and the steps the group takes — everything
 * {@link group} has but its own {@link powTail}.
 * `-(1).x` is the negation of the access, but `-(1) ** 2` is a syntax
 * error in JavaScript, so {@link unaryOperand}'s restricted `(` stops
 * here rather than reaching {@link group}'s own.
 *
 * @type {GroupOperand}
 */
export const groupOperand = [value, sym(')'), accesses]

/**
 * `(` and {@link groupOperand}: what a prefix may take in
 * parentheses, {@link unaryOperand}'s own `(` branch — not {@link
 * parenGroup}, whose {@link group} still carries a `**` of its own.
 *
 * @type {ParenGroupOperand}
 */
export const parenGroupOperand = [sym('('), groupOperand]

/** What follows a key: `:` and the value. */
const valued = /** @type {const} */ ([sym(':'), value])

/**
 * A member of an object, `key: value`, by the key's spelling: a bare
 * identifier, a string literal, or a computed `["a"]`, the three spellings
 * of one constant key. The bare one alone may stand without a value,
 * `{ a }`, the shorthand JavaScript reads as `a: a`: the name is a reference
 * as well as a key, which a string or a bracket spells no more than a
 * string does after `.`.
 *
 * @type {Member}
 */
export const member = /** @type {const} */ ({
    plain: [identifierName, option(valued)],
    string: [sym('string'), ...valued],
    computed: [sym('['), sym('string'), sym(']'), ...valued],
})

/**
 * An entry of an object: a member, or a spread of a value, `...value`,
 * whose operand is any value, as JavaScript's `PropertyDefinition` takes
 * an `AssignmentExpression` after `...`. `...` begins no key, so one
 * symbol decides.
 *
 * @type {Entry}
 */
export const entry = { spread: [sym('...'), value], member }

/** The entries of an object, likewise. */
export const entries = items(entry)

/**
 * An item of an array or of a call's arguments: a value, or a spread of
 * one, `...value`, whose operand is any value, as JavaScript's
 * `SpreadElement` takes an `AssignmentExpression`. `...` begins no value,
 * so one symbol decides; and a rest parameter's `...` is never read here,
 * since a parameter list is read by its own rule, after a value's `(`.
 *
 * @type {Item}
 */
export const item = { spread: [sym('...'), value], value }

/** The items of an array. A rule of its own, so that a reader may map it. */
export const values = items(item)

export const array = /** @type {const} */ ([sym('['), option(values), sym(']')])

export const object = /** @type {const} */ ([sym('{'), option(entries), sym('}')])

/**
 * A statement's terminator: `;`, or nothing, where JavaScript inserts the
 * `;` itself — before a token on a new line, before `}`, and at the end
 * of input. The grammar admits the omission everywhere and asks nothing
 * of what follows: `;` begins no statement and no statement's
 * continuation, so one symbol of lookahead still decides. Whether the
 * token after an omitted `;` begins a line is the token's to say,
 * `newline` in `DjsTokenWithMetadata`, and the reader in `../module.f.mjs`
 * refuses the same-line case JavaScript refuses.
 *
 * @type {End}
 */
export const end = option([sym(';')])

/**
 * A `const` statement: the name, `=`, the value, and its {@link end}. A
 * module's statement and a function body's alike — {@link djsModule} takes
 * a run of them after the imports, and {@link block} a run of them before
 * the `return`.
 *
 * Declared here, above {@link block}, rather than with the other module
 * statements below: `block` holds it directly, where the recursion back
 * into `value` goes through a thunk.
 */
export const constStatement = /** @type {const} */ ([
    sym('const'), identifierName, sym('='), value, end,
])

/**
 * The statement a block ends with, {@link terminator}: `return value`, or
 * `throw value` — the function fails with the value, the language's one way
 * to fail on purpose ([spec: functions](../../../../spec/README.md#functions)).
 * Each is followed by its own {@link end}. JavaScript has
 * `throw [no LineTerminator here] Expression` exactly as it has `return`'s,
 * so the reader refuses a value beginning a line after either the same way
 * ({@link block}). One symbol decides between the two.
 *
 * @type {Terminator}
 */
export const terminator = /** @type {const} */ ({
    return: [sym('return'), value, end],
    throw: [sym('throw'), value, end],
})

/**
 * A statement of a function's block body before its {@link terminator}: a
 * `const`, or a guard, `if (condition) block` — its block this same
 * {@link block}, so the branch always ends in `return` or `throw`, and the
 * statements after the guard are what runs when the condition is falsy
 * ([spec: functions](../../../../spec/README.md#functions)). No {@link end}
 * follows the guard's `}`: a block statement takes no `;` in JavaScript,
 * and one written there is the empty statement the language refuses, as
 * `;;` is. `const` and `if` decide the two in one symbol. A thunk, since
 * the block holds this rule and this rule holds the block.
 *
 * The bare consequent, `if (c) return v;`, and `else` are not read: the
 * guard admits one form, and the others are follow-ups
 * ([spec: functions](../../../../spec/README.md#functions)).
 *
 * @type {Statement}
 */
export const statement = () => ['const', {
    const: constStatement,
    if: [sym('if'), sym('('), value, sym(')'), block],
}]

/**
 * A function's block body: `{ const x = 1; return value; }` — any number of
 * {@link statement}s, `const`s and guards, and then the one
 * {@link terminator}, a `return` or a `throw`
 * ([spec: functions](../../../../spec/README.md#functions)).
 *
 * The `const` is {@link constStatement}, the module's own rule: the body
 * binds names the way a module does, and the fold is what says the two
 * scopes are different — a body's name is the body's, and a reference out
 * of it is a capture.
 *
 * The value is an ordinary {@link value}, the object included: `{` opens a
 * block only where a statement may start, and after `return` an expression
 * is expected, so `=> { return { a: 1 }; }` returns an object literal. It is
 * the spelling a *bare* one needs: `=> {` opens a block, so the expression
 * body reaches the same object through a group, `=> ({ a: 1 })`, and the two
 * are one function.
 *
 * JavaScript has `return [no LineTerminator here] Expression`: a newline
 * there ends the statement by automatic semicolon insertion, so `return`
 * and the value on two lines would return `undefined` in JavaScript and
 * this value here. The grammar reads the value either way, trivia being
 * no symbol of it, and the reader in `../module.f.mjs` refuses the value
 * whose first token began a line — the same way it refuses an `=>` after
 * one, {@link func}.
 *
 * The terminator's {@link end} may be omitted before the `}`, as it may in
 * JavaScript, and a `const`'s where the statement after it begins a line.
 *
 * @type {Block}
 */
export const block = /** @type {const} */ ([
    sym('{'), repeatFrom0(statement), terminator, sym('}'),
])

/**
 * An import's attribute, `with { type: "json" }` as JavaScript spells the
 * one attribute it defines: the key any identifier and the value any
 * string here, since the grammar sees symbols and the fold reads the words
 * — the key has to be `type` and the value `json`, and the fold says which
 * is not.
 *
 * The key is {@link identifierName} and not the bare `id` symbol, so that a
 * word with a symbol of its own stands here as any other word does:
 * JavaScript's key is an `IdentifierName`, which admits every reserved
 * word, and giving a word its own symbol narrows where it is *required*,
 * never where it is *allowed*. `with { return: "json" }` and
 * `with { NaN: "json" }` are unknown attributes, which is the fold's to
 * say, not a token the grammar did not expect.
 */
export const attribute = /** @type {const} */ ([
    sym('with'), sym('{'), identifierName, sym(':'), sym('string'), sym('}'),
])

/** An exported identifier and an optional local alias. */
export const importBinding = /** @type {const} */ ([
    identifierName, option([sym('as'), identifierName]),
])

/** Named bindings use the same empty/trailing-comma convention as other lists. */
export const importBindings = items(importBinding)

export const namedImports = /** @type {const} */ ([
    sym('{'), option(importBindings), sym('}'),
])

export const importClause = /** @type {const} */ ({
    named: namedImports,
    default: [identifierName, option([sym(','), namedImports])],
})

export const importStatement = /** @type {const} */ ([
    sym('import'), importClause, sym('from'), sym('string'), option(attribute), end,
])

/**
 * What a module ends with, after its imports and constants: its exports —
 * `export default value`, or an exported `const`, the statements after it,
 * and optionally the rest of this rule again — or a `throw`, which stands
 * where `export default` would and ends the module as it ends a block: a
 * module is a function ([spec: a module is a
 * function](../../../../spec/README.md#a-module-is-a-function)), so its
 * body may end in the terminator a function's may, in place of what it
 * would return. `export` and `throw` decide the two in one symbol.
 *
 * @type {LastStatement}
 */
export const lastStatement = () => ['const', {
    export: [sym('export'), {
        default: [sym('default'), value, end],
        named: [constStatement, repeatFrom0(constStatement), option(lastStatement)],
    }],
    throw: [sym('throw'), value, end],
}]

/**
 * The whole module: imports first, ordinary and exported constants in order,
 * and {@link lastStatement} — at least one export, or a `throw`. Ending on
 * `eof` is what makes a trailing stray token a failure.
 */
export const djsModule = /** @type {const} */ ([
    repeatFrom0(importStatement),
    repeatFrom0(constStatement),
    lastStatement,
    eof,
])
