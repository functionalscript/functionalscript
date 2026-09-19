/**
 * The djs module grammar over token symbols, spelled LL(1) for
 * `fjs/ebnf/ll1`, which `../module.f.mjs` reads a module with:
 *
 * ```text
 * module ::= t import* const* export eof
 * import ::= 'import' t id t 'from' t string t [ 'with' t '{' t id t ':' t string t '}' t ] ';' t
 * const  ::= 'const' t id t '=' t value ';' t
 * export ::= 'export' t 'default' t value ';' t
 * value  ::= '-' t unaryOperand tail | '~' t unaryOperand tail
 *          | (primitive t | id t | array | object) access* powTail tail
 *          | '(' t (func | group tail)
 * body   ::= '-' t unaryOperand tail | '~' t unaryOperand tail
 *          | (primitive t | id t | array) access* powTail tail
 *          | '(' t (func | group tail) | block
 * unary  ::= '-' t unaryOperand | '~' t unaryOperand
 *          | (primitive t | id t | array | object) access* powTail
 *          | '(' t group
 * unaryOperand ::= '-' t unaryOperand | '~' t unaryOperand
 *          | (primitive t | id t | array | object) access*
 *          | '(' t groupOperand
 * block  ::= '{' t const* 'return' s value ';' t '}' t
 * func   ::= [ '...' t id t ] ')' s '=>' t body
 * group  ::= value ')' t access* powTail
 * groupOperand ::= value ')' t access*
 * powTail ::= [ '**' t unary ]
 * tail   ::= { mulOp t unary }
 *            { addOp t unary <the multiplicative repeat above> }
 *            …six more layers, each repeating over every layer below it
 *            the same way — shift, relational, equality, bitwiseAnd,
 *            bitwiseXor, bitwiseOr, in that order, JavaScript's own
 * access ::= '.' t id t | '[' t (string | number) t ']' t | '(' t [ items(value) ] ')' t
 * array  ::= '[' t [ items(value) ] ']' t
 * object ::= '{' t [ items(member) ] '}' t
 * member ::= key t ':' t value
 * key    ::= id | string | '[' t string t ']'
 * items  ::= item [ ',' t [ items ] ]
 * t      ::= (ws | nl | comment)*
 * s      ::= (ws | comment)*
 * ```
 *
 * A `(` opens two things, so it is read before either: {@link paren} takes
 * the `(` and {@link func} and {@link group} part at the next symbol, `...`
 * against a value's first, which is how a function and a group live in one
 * grammar without lookahead past the `)` — where JavaScript itself needs
 * it, and where parenthesized parameters will
 * ([`spec/todo/3120-parameters.md`](../../../../spec/todo/3120-parameters.md)).
 *
 * `tail`, the binary-operator suffix — Stage A of
 * [`spec/todo/2340-operators.md`](../../../../spec/todo/2340-operators.md)
 * — is spread inline onto every branch that may carry one, rather than
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
 * port and recorded in `fjs/fsc/README.md` ("Both grammars are LL(1)"):
 *
 * - **Trivia follows a token, never leads a rule.** Every token is
 *   followed by `t`, so no rule begins with trivia and no two branches
 *   begin with it; the classical grammar's statement terminator and the
 *   module's final optional `;` both did.
 * - **`;` ends every statement, the export included.** A newline does
 *   not: it is the rule `spec/README.md` states for FunctionalScript, it
 *   is what DataJS requires, and deciding between a newline and a `;`
 *   reached through newlines took unbounded lookahead.
 * - **A list is right-recursive.** After an item and its comma, one
 *   symbol of lookahead says whether an item or the closing bracket
 *   follows, so a trailing comma is a comma nothing follows; the classical
 *   grammar rested it on a failed repetition round rewinding.
 *
 * The alphabet is {@link _ordinaryTokenNames}: one name per token kind,
 * and the seven keywords with names of their own, since the
 * tokenizer emits them as identifiers — encoded by `fjs/ebnf/token_symbol`;
 * `eof` has none, since the backend synthesizes the end of input. A symbol
 * is a rule of one symbol, so a terminal is the symbol a token is encoded
 * to and nothing else.
 *
 * @module
 *
 * @import { Meta } from '../../../ebnf/ast/types.ts'
 * @import { Rule } from '../../../ebnf/types.ts'
 * @import { DjsTokenWithMetadata } from '../../tokenizer/types.ts'
 * @import { Access, Block, Body, Func, Group, GroupOperand, Items, Member, Parameters, Paren, ParenGroup, ParenGroupOperand, Parenthesized, PowTail, Tail, Unary, UnaryOperand, Value } from './types.ts'
 */

import { assert } from '../../../asserts/module.f.mjs'
import { eof, option, repeatFrom0 } from '../../../ebnf/module.f.mjs'
import { encoding } from '../../../ebnf/token_symbol/module.f.mjs'

/**
 * The token kinds, every `DjsToken` kind but `eof`: the tokenizer's
 * physical end-of-input token is split off the stream before any name is
 * mapped, and the backend synthesizes its own logical one.
 *
 * The names are the *token* vocabulary, not the tokenizer grammar's tag
 * vocabulary: only twelve punctuators survive into `DjsToken`, so the JS
 * operator set the tokenizer recognizes is far larger than what reaches
 * this layer.
 *
 * The `_…AreComplete` assertions in `./proof.f.mjs` check both halves
 * against `DjsToken` and `_FramingKeyword` at compile time, so a kind or
 * keyword added there breaks the build rather than going unrepresented.
 * Exported with a leading `_` for that linkage — the export is not API.
 */
export const _tokenKindNames = /** @type {const} */ ([
    'true', 'false', 'null', 'undefined', 'NaN', 'Infinity',
    '{', '}', ':', ',', '[', ']', '.', '=', ';', '(', ')', '=>', '...', '-',
    '+', '*', '/', '%', '**',
    '===', '!==', '>', '>=', '<', '<=',
    '&', '|', '^', '~', '<<', '>>', '>>>',
    'string', 'number', 'error', 'id', 'bigint',
    'ws', 'nl', '//', '/*',
])

/**
 * The keywords a rule below *requires* in some position, which the
 * tokenizer emits as `id` tokens carrying the word in `value`. Kept as its
 * own list because {@link symbolOf} has to recognize exactly these values,
 * not merely encode them. Six frame a module and `return` frames a
 * function's block body.
 *
 * **A grammar over this alphabet owes them an identifier rule.** Once each
 * carries its own symbol, a rule whose identifier terminal is the bare `id`
 * symbol rejects every one of them, which is what {@link identifier} is
 * for: the union of `id` and the seven. Which of them a position may hold is
 * the fold's to say, since it is a property of the word — JavaScript
 * reserves six and `from` alone is ordinary, and it lets every reserved
 * word stand as a key or after `.`, so `{ default: 3 }`, `{ return: 3 }`
 * and `a.with` parse and `const export = 1;` is refused by the fold, as
 * `const if = 1;` is.
 *
 * Giving a word its own symbol narrows where it is *required*, never where
 * it is *allowed*.
 */
export const _framingKeywords = /** @type {const} */ (['import', 'const', 'export', 'default', 'from', 'with', 'return'])

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

/** Trivia between any two tokens; it follows every token below. */
export const trivia = repeatFrom0({
    ws: sym('ws'),
    nl: sym('nl'),
    lineComment: sym('//'),
    blockComment: sym('/*'),
})

/**
 * Trivia on one line: {@link trivia} less the newline, where JavaScript
 * has `[no LineTerminator here]` — before `=>`. A block comment holding a
 * newline is refused too, since the tokenizer follows it with `nl`, and a
 * line comment ends at the newline it is followed by; the Unicode line and
 * paragraph separators are no token outside a string, so none stands here.
 */
export const sameLine = repeatFrom0({
    ws: sym('ws'),
    lineComment: sym('//'),
    blockComment: sym('/*'),
})

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
})

/**
 * Every word that may *name* something — a property, or a binding — which
 * is {@link identifier} and the six words that denote a value.
 *
 * ECMAScript draws the same line and this follows it: a property is named
 * by an `IdentifierName`, which admits every reserved word, so `{ NaN: 1 }`
 * and `a.NaN` are JavaScript and mean the string `"NaN"`, while a reference
 * is an `IdentifierReference`, which admits none of them. A binding is an
 * ECMAScript `BindingIdentifier`, narrower still; it takes this wider rule
 * here so that `const NaN = 1;` reaches the fold and is refused as a
 * `reserved word`, rather than dying at the token with `unexpected token`.
 *
 */
export const identifierName = /** @type {const} */ ({
    ...identifier,
    null: sym('null'),
    true: sym('true'),
    false: sym('false'),
    undefined: sym('undefined'),
    NaN: sym('NaN'),
    Infinity: sym('Infinity'),
})

/** A value that is one token. */
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
 * An item ends with its own trivia — every item is a value or ends in one —
 * so none stands between an item and its comma.
 *
 * @type {<const I extends Rule>(item: I) => Items<I>}
 */
export const items = item => {
    /** @type {Items<typeof item>} */
    const list = () => ['const', [item, option([sym(','), trivia, option(list)])]]
    return list
}

/** The constants an index may be: a string, or a number. */
export const index = /** @type {const} */ ({
    string: sym('string'),
    number: sym('number'),
})

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
 * @type {() => ReturnType<Items<Value>>}
 */
export const callArguments = () => values()

/**
 * One step after a value: a property access, `.name` with the name any
 * identifier or `[key]` with the key a constant, or a call, `(a, b)` with
 * its arguments any values. What a property's two spellings may name is the
 * fold's to check, since the name is a word the grammar does not see. Each
 * step ends with its trivia, as a value does.
 *
 * Three symbols decide between them — `.`, `[` and `(` — and none of them
 * follows a value any other way, so the step a value takes is read in one.
 * `f(1)(2)` and `a.b(1)[0]` are steps upon steps, as `a.b[0]` is: what a
 * step applies to is everything written before it.
 */
export const access = /** @type {Access} */ ({
    property: [sym('.'), trivia, identifierName, trivia],
    index: [sym('['), trivia, index, trivia, sym(']'), trivia],
    call: [sym('('), trivia, option(callArguments), sym(')'), trivia],
})

/** The accesses after a value, `a.b[0]`, none or more. */
const accesses = repeatFrom0(access)

/** A primitive value and its trivia, then its accesses. */
const primitiveValue = /** @type {const} */ ([[primitive, trivia], accesses])

/** A reference and its trivia, then its accesses. */
const reference = /** @type {const} */ ([[identifier, trivia], accesses])

/** `*`, `/`, `%` — the binary layer directly above {@link unary}. */
const multiplicativeOp = /** @type {const} */ ({ mul: sym('*'), div: sym('/'), mod: sym('%') })

/**
 * `+`, `-` — above {@link multiplicativeOp}. The `-` here is subtraction,
 * distinct from the `neg` prefix {@link unary} already owns: the two share
 * a token and nothing else, one an operator of two operands and the other
 * of one, told apart by which branch of the grammar reads them.
 */
const additiveOp = /** @type {const} */ ({ add: sym('+'), sub: sym('-') })

/** `<<`, `>>`, `>>>` — above {@link additiveOp}. */
const shiftOp = /** @type {const} */ ({ left: sym('<<'), right: sym('>>'), unsigned: sym('>>>') })

/** `<`, `<=`, `>`, `>=` — above {@link shiftOp}. */
const relationalOp = /** @type {const} */ ({ lt: sym('<'), le: sym('<='), gt: sym('>'), ge: sym('>=') })

/** `===`, `!==` — above {@link relationalOp}; `==`/`!=` are not this language's, per `spec/todo/2340-operators.md`. */
const equalityOp = /** @type {const} */ ({ eq: sym('==='), ne: sym('!==') })

/** `&` — above {@link equalityOp}. */
const bitwiseAndOp = /** @type {const} */ ({ and: sym('&') })

/** `^` — above {@link bitwiseAndOp}. */
const bitwiseXorOp = /** @type {const} */ ({ xor: sym('^') })

/** `|` — above {@link bitwiseXorOp}, the ladder's own top. */
const bitwiseOrOp = /** @type {const} */ ({ or: sym('|') })

/**
 * A function's parameter list: the one rest parameter, `(...a)`, or
 * nothing, `()`. One symbol decides between them — `...` opens the
 * parameter and `)` closes an empty list, and a list is written nowhere
 * else, so neither reaches here any other way.
 *
 * It is what tells a function from a group past {@link paren}'s `(` as
 * well: a `...` or a `)` is this rule, and everything a group may start
 * with is a value's, the two sets sharing nothing.
 *
 * A list of named parameters is the rule this one grows into
 * ([parameters](../../../../spec/todo/3120-parameters.md)), which is why
 * the option is a rule of its own rather than spelled inside
 * {@link func}: what the list holds is this rule's to say, and a reader
 * takes the parameter from its mapping either way.
 *
 * @type {Parameters}
 */
export const parameters = option([sym('...'), trivia, identifierName, trivia])

/**
 * What a `-` or a `~` takes: every value but a function. JavaScript's
 * unary operand is a `UnaryExpression`, which an arrow function is not —
 * `-(...a) => 1` and `~(...a) => 1` are syntax errors there, so they are
 * here — and each branch is right-recursive, so `- -1` is a negation of a
 * negation and `~ ~1` a bitwise-not of one. `--1` and `~~1` are not
 * either's own token: `--` is the decrement token the language has no rule
 * for, and `~~1` is two prefixes, not one operator, the tokenizer reading
 * `~` and `~` where it reads `-` and `-` for the other.
 *
 * A group is an operand, {@link parenGroup}, and it is how a function
 * reaches a `-`/`~` at all: `-((...a) => 1)` negates one where
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
    neg: [sym('-'), trivia, unaryOperand],
    bitnot: [sym('~'), trivia, unaryOperand],
    primitive: [primitiveValue, powTail],
    ref: [reference, powTail],
    array: [[array, accesses], powTail],
    object: [[object, accesses], powTail],
    group: parenGroup,
}]

/**
 * `**`'s right operand, when a primary, a group, or `-`/`~`'s own operand
 * is raised to a power: right-associative, so `2 ** 3 ** 2` is
 * `2 ** (3 ** 2)`, and reaching back into {@link unary} — not stopping at
 * a bare primary — is how `2 ** -2` and `2 ** ~2` stand without
 * parentheses: `unary`'s own prefixes recurse into {@link unaryOperand},
 * which is what keeps `2 ** -2 ** 2` a syntax error exactly as it is in
 * JavaScript, the inner `-2 ** 2` refused the same way the outer would be.
 *
 * @type {PowTail}
 */
const powTail = option([sym('**'), trivia, unary])

/**
 * What a `-` or a `~` takes: every alternative {@link unary} has — a
 * primitive, a reference, an array, an object, a group, or a further
 * `-`/`~` — but none of them carries {@link powTail}, here or through any
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
 * So {@link unary}'s own neg/bitnot branches, and {@link value}'s and
 * {@link body}'s, all reach this rule for their operand rather than
 * `unary` itself — and this rule reaches itself, not `unary`, for a
 * nested `-`/`~`'s own operand, `- -2 ** 2` refused the same way `- 2 **
 * 2` is rather than only the outer prefix carrying the restriction.
 *
 * The four leaves are each still wrapped one tuple deep, `[primitiveValue]`
 * rather than `primitiveValue` bare, matching {@link unary}'s own
 * `[primitiveValue, powTail]` at the same depth minus the slot `powTail`
 * held — `./module.f.mjs`'s reader shares one function, `baseOf`, between
 * both rules, and that depth is what lets it.
 *
 * @type {UnaryOperand}
 */
export const unaryOperand = () => ['const', {
    neg: [sym('-'), trivia, unaryOperand],
    bitnot: [sym('~'), trivia, unaryOperand],
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
const multiplicativeTail = repeatFrom0([multiplicativeOp, trivia, unary])

/**
 * `+`, `-` — above {@link multiplicativeTail}. Each repeated operand is a
 * {@link unary} followed by its own {@link multiplicativeTail}, so `1 + 2
 * * 3` nests as `1 + (2 * 3)` rather than `(1 + 2) * 3`.
 */
const additiveTail = repeatFrom0([additiveOp, trivia, unary, multiplicativeTail])

/** `<<`, `>>`, `>>>` — above {@link additiveTail}. */
const shiftTail = repeatFrom0([shiftOp, trivia, unary, multiplicativeTail, additiveTail])

/** `<`, `<=`, `>`, `>=` — above {@link shiftTail}. */
const relationalTail = repeatFrom0([relationalOp, trivia, unary, multiplicativeTail, additiveTail, shiftTail])

/** `===`, `!==` — above {@link relationalTail}; `==`/`!=` are not this language's, per `spec/todo/2340-operators.md`. */
const equalityTail = repeatFrom0([equalityOp, trivia, unary, multiplicativeTail, additiveTail, shiftTail, relationalTail])

/** `&` — above {@link equalityTail}. */
const bitwiseAndTail = repeatFrom0([bitwiseAndOp, trivia, unary, multiplicativeTail, additiveTail, shiftTail, relationalTail, equalityTail])

/** `^` — above {@link bitwiseAndTail}. */
const bitwiseXorTail = repeatFrom0([bitwiseXorOp, trivia, unary, multiplicativeTail, additiveTail, shiftTail, relationalTail, equalityTail, bitwiseAndTail])

/** `|` — above {@link bitwiseXorTail}, the ladder's own top. */
const bitwiseOrTail = repeatFrom0([bitwiseOrOp, trivia, unary, multiplicativeTail, additiveTail, shiftTail, relationalTail, equalityTail, bitwiseAndTail, bitwiseXorTail])

/**
 * The whole binary-operator suffix, {@link multiplicativeTail} through
 * {@link bitwiseOrTail}, spread onto every branch of {@link value} and
 * {@link body} that may carry one.
 *
 * @type {Tail}
 */
const tail = [
    multiplicativeTail, additiveTail, shiftTail, relationalTail,
    equalityTail, bitwiseAndTail, bitwiseXorTail, bitwiseOrTail,
]

/**
 * A value: a primitive token, a reference, an array, an object, a `-`/`~`
 * prefix, or `(` — the choice between a function and a group,
 * {@link parenthesized} — each ending with its own {@link tail}, the
 * binary-operator suffix, except the function: nothing may follow one
 * unparenthesized, `=>` reading everything to its right as the body, so
 * {@link func} alone stands bare where the others carry {@link tail}. A
 * `const` thunk whose payload names the thunk, which is what lets a type
 * alias name itself.
 *
 * Any value takes accesses, as any expression does in JavaScript:
 * `[1].length`, `"ab"[0]`, `{ a: 1 }.a`. `1 .x` parses here too, with a
 * space since `1.x` is one number and a stray word in JavaScript. Stage A
 * of [`spec/todo/2340-operators.md`](../../../../spec/todo/2340-operators.md):
 * arithmetic (`+ - * / % **`, and unary `-`), strict comparison
 * (`=== !== > >= < <=`), and bitwise (`& | ^ ~ << >> >>>`). `==`/`!=` stay
 * refused, and the lazy (`&& || ?? ?:`) and comma stages wait on `tail`'s
 * current top, `bitwiseOr`.
 *
 * @type {Value}
 */
export const value = () => ['const', {
    neg: [sym('-'), trivia, unaryOperand, ...tail],
    bitnot: [sym('~'), trivia, unaryOperand, ...tail],
    primitive: [primitiveValue, powTail, ...tail],
    ref: [reference, powTail, ...tail],
    array: [[array, accesses], powTail, ...tail],
    object: [[object, accesses], powTail, ...tail],
    paren,
}]

/**
 * A function's body: a value less the object — after `=>` JavaScript reads
 * `{` as a block, never as an object, so the spelling is refused rather
 * than read another way — or that block, {@link block}, in which an
 * object is an ordinary value again, or a group, which is the other
 * spelling of a body that is an object, `(...a) => ({ x: 1 })`. Every
 * branch but {@link func} and {@link block} carries {@link tail} exactly
 * as {@link value}'s own branches do, for the same reason.
 *
 * `{` decides the block in one symbol, since no other branch starts with
 * it — and after a `-`/`~` it opens an object again, the prefix putting
 * what follows it in expression position, which is why those branches are
 * {@link unary} rather than this rule. `(` decides the function or the
 * group, {@link parenthesized}.
 *
 * @type {Body}
 */
export const body = () => ['const', {
    neg: [sym('-'), trivia, unaryOperand, ...tail],
    bitnot: [sym('~'), trivia, unaryOperand, ...tail],
    primitive: [primitiveValue, powTail, ...tail],
    ref: [reference, powTail, ...tail],
    array: [[array, accesses], powTail, ...tail],
    paren,
    block,
}]

/**
 * A function after its `(`: its parameter list, the `)`, then `=>` on the
 * same line as that `)`, as JavaScript requires, and the body, which ends
 * with its own trivia as every value does. The parameter is the arguments
 * array, and the body names it and nothing outside — which names it may
 * use is the fold's to say, since a name is a word the grammar does not
 * see. A function with no parameter names nothing at all, its arguments
 * included.
 *
 * The `(` is {@link paren}'s, since a group opens with the same symbol.
 * Nothing follows a function directly — see {@link unary}'s own comment —
 * so unlike every other branch of {@link value}/{@link body}, this one
 * carries no {@link tail}.
 *
 * @type {Func}
 */
export const func = [parameters, sym(')'), sameLine, sym('=>'), trivia, body]

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
 * {@link powTail} — `(1 + 2) ** 2` — the one place a group needs its own,
 * since {@link unary}'s restricted `(` and {@link value}'s full one both
 * stand on this same rule and inherit it from here. {@link tail}, the
 * binary-operator suffix, is not this rule's: it belongs to whichever of
 * {@link parenthesized}'s two branches follows the `)`, since only one of
 * them — the group — may carry one.
 *
 * @type {Group}
 */
export const group = [value, sym(')'), trivia, accesses, powTail]

/**
 * What a `(` opens: the rest of a function, or a group followed by
 * {@link tail}, the binary-operator suffix — `(1 + 2) * 3` — the one
 * branch of {@link value}/{@link body}'s own `paren` choice that may carry
 * one, a function taking none. `...` decides it in one symbol — no value
 * begins with one — so the two share the `(` and the grammar never looks
 * past the `)`.
 *
 * @type {Parenthesized}
 */
export const parenthesized = { func, group: [group, ...tail] }

/**
 * A `(` and what it opens: the `(`-alternative of {@link value} and of
 * {@link body} both, since a function and a group stand wherever a value
 * does.
 *
 * @type {Paren}
 */
export const paren = [sym('('), trivia, parenthesized]

/**
 * A `(` and the group it opens, with no function among the alternatives:
 * {@link unary}'s `(` branch. A group after a `-` takes its own steps, so
 * `-(1).x` is the negation of the access, as JavaScript reads it.
 *
 * @type {ParenGroup}
 */
export const parenGroup = [sym('('), trivia, group]

/**
 * A group after its `(`, without the power {@link group} itself may
 * carry: the value, `)`, the trivia after it, and the steps the group
 * takes — everything {@link group} has but its own {@link powTail}.
 * `-(1).x` is the negation of the access, but `-(1) ** 2` is a syntax
 * error in JavaScript, so {@link unaryOperand}'s restricted `(` stops
 * here rather than reaching {@link group}'s own.
 *
 * @type {GroupOperand}
 */
export const groupOperand = [value, sym(')'), trivia, accesses]

/**
 * `(`, trivia and {@link groupOperand}: what a `-`/`~` may take in
 * parentheses, {@link unaryOperand}'s own `(` branch — not {@link
 * parenGroup}, whose {@link group} still carries a `**` of its own.
 *
 * @type {ParenGroupOperand}
 */
export const parenGroupOperand = [sym('('), trivia, groupOperand]

/** A property name: bare identifier, string literal, or a computed `["a"]`. */
export const key = /** @type {const} */ ({
    plain: identifierName,
    string: sym('string'),
    computed: [sym('['), trivia, sym('string'), trivia, sym(']')],
})

/** @type {Member} */
export const member = [key, trivia, sym(':'), trivia, value]

/** The members of an object, likewise. */
export const members = items(member)

/** The items of an array. A rule of its own, so that a reader may map it. */
export const values = items(value)

export const array = /** @type {const} */ ([sym('['), trivia, option(values), sym(']'), trivia])

export const object = /** @type {const} */ ([sym('{'), trivia, option(members), sym('}'), trivia])

/** A statement's terminator: `;`, then the trivia after it. */
const end = /** @type {const} */ ([sym(';'), trivia])

/**
 * A `const` statement: the name, `=`, the value, `;`. A module's statement
 * and a function body's alike — {@link djsModule} takes a run of them after
 * the imports, and {@link block} a run of them before the `return`.
 *
 * Declared here, above {@link block}, rather than with the other module
 * statements below: `block` holds it directly, where the recursion back
 * into `value` goes through a thunk.
 */
export const constStatement = /** @type {const} */ ([
    sym('const'), trivia, identifierName, trivia, sym('='), trivia, value, ...end,
])

/**
 * A function's block body: `{ const x = 1; return value; }` — any number of
 * `const` statements and then the one `return`
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
 * `s` and not `t` before it, where JavaScript has
 * `return [no LineTerminator here] Expression`: a newline there ends the
 * statement by automatic semicolon insertion, so `return` and the value on
 * two lines would return `undefined` in JavaScript and this value here.
 * The same reason {@link func} has `s` before `=>`.
 *
 * The `;` is required, as it is after every statement: this language ends a
 * statement at a `;` and never where an engine infers one.
 *
 * @type {Block}
 */
export const block = /** @type {const} */ ([
    sym('{'), trivia, repeatFrom0(constStatement), sym('return'), sameLine, value, ...end, sym('}'), trivia,
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
    sym('with'), trivia, sym('{'), trivia, identifierName, trivia, sym(':'), trivia, sym('string'), trivia, sym('}'), trivia,
])

export const importStatement = /** @type {const} */ ([
    sym('import'), trivia, identifierName, trivia, sym('from'), trivia, sym('string'), trivia, option(attribute), ...end,
])

export const exportStatement = /** @type {const} */ ([
    sym('export'), trivia, sym('default'), trivia, value, ...end,
])

/**
 * The whole module: every `import` before every `const`, one
 * `export default` last, each ended by `;`, and nothing but trivia around
 * them. Ending on `eof` is what makes a trailing stray token a failure.
 */
export const djsModule = /** @type {const} */ ([
    trivia,
    repeatFrom0(importStatement),
    repeatFrom0(constStatement),
    exportStatement,
    eof,
])
