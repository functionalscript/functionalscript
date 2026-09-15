/**
 * The djs module grammar over token symbols, spelled LL(1) for
 * `fjs/ebnf/ll1`, which `../module.f.mjs` reads a module with:
 *
 * ```text
 * module ::= t import* const* export eof
 * import ::= 'import' t id t 'from' t string t [ 'with' t '{' t id t ':' t string t '}' t ] ';' t
 * const  ::= 'const' t id t '=' t value ';' t
 * export ::= 'export' t 'default' t value ';' t
 * value  ::= (primitive t | id t | array | object) access* | func
 * body   ::= (primitive t | id t | array) access* | func
 * func   ::= '(' t '...' t id t ')' s '=>' t body
 * access ::= '.' t id t | '[' t (string | number) t ']' t
 * array  ::= '[' t [ items(value) ] ']' t
 * object ::= '{' t [ items(member) ] '}' t
 * member ::= key t ':' t value
 * key    ::= id | string | '[' t string t ']'
 * items  ::= item [ ',' t [ items ] ]
 * t      ::= (ws | nl | comment)*
 * s      ::= (ws | comment)*
 * ```
 *
 * Three things are spelled for one symbol of lookahead, each a conflict
 * the classical grammar this replaced had, measured before the port and
 * recorded in `fjs/fsc/README.md` ("Both grammars are LL(1)"):
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
 * and the six framing keywords with names of their own, since the
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
 * @import { Body, Func, Items, Member, Value } from './types.ts'
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
    'true', 'false', 'null', 'undefined', 'NaN', 'Infinity', '-Infinity',
    '{', '}', ':', ',', '[', ']', '.', '=', ';', '(', ')', '=>', '...',
    'string', 'number', 'error', 'id', 'bigint',
    'ws', 'nl', '//', '/*',
])

/**
 * The framing keywords, which the tokenizer emits as `id` tokens carrying
 * the word in `value`. Kept as its own list because {@link symbolOf} has to
 * recognize exactly these values, not merely encode them.
 *
 * **A grammar over this alphabet owes them an identifier rule.** Once each
 * carries its own symbol, a rule whose identifier terminal is the bare `id`
 * symbol rejects every one of them, which is what {@link identifier} is
 * for: the union of `id` and the six. Which of them a position may hold is
 * the fold's to say, since it is a property of the word — JavaScript
 * reserves five and `from` alone is ordinary, and it lets every reserved
 * word stand as a key or after `.`, so `{ default: 3 }` and `a.with` parse
 * and `const export = 1;` is refused by the fold, as `const if = 1;` is.
 *
 * Giving a word its own symbol narrows where it is *required*, never where
 * it is *allowed*.
 */
export const _framingKeywords = /** @type {const} */ (['import', 'const', 'export', 'default', 'from', 'with'])

/**
 * The complete alphabet: one name per `DjsToken` kind except `eof`, plus
 * one per framing keyword. No keyword collides with a kind, so the two
 * lists concatenate without a name being registered twice — which
 * `encoding` would reject anyway.
 */
export const _ordinaryTokenNames = [..._tokenKindNames, ..._framingKeywords]

const alphabet = encoding(_ordinaryTokenNames)

/** The symbol of a token name: what a token is encoded to, and the terminal that names it. */
export const sym = alphabet.encode

/**
 * One token as the parser's input: the symbol of its kind — of its word,
 * for a framing keyword — with the whole token as metadata, so that a fold
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
 * framing keywords, which arrive as `id` tokens too. Whether the word is
 * reserved there is the fold's to check, as it is for every other keyword.
 */
export const identifier = /** @type {const} */ ({
    id: sym('id'),
    import: sym('import'),
    const: sym('const'),
    export: sym('export'),
    default: sym('default'),
    from: sym('from'),
    with: sym('with'),
})

/** A value that is one token. */
export const primitive = /** @type {const} */ ({
    null: sym('null'),
    true: sym('true'),
    false: sym('false'),
    undefined: sym('undefined'),
    NaN: sym('NaN'),
    Infinity: sym('Infinity'),
    '-Infinity': sym('-Infinity'),
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
 * One step of a property access after a value: `.name`, the name any
 * identifier, or `[key]`, the key a constant. What the two spellings may
 * name is the fold's to check, since the name is a word the grammar does
 * not see. Each step ends with its trivia, as a value does.
 */
export const access = /** @type {const} */ ({
    property: [sym('.'), trivia, identifier, trivia],
    index: [sym('['), trivia, index, trivia, sym(']'), trivia],
})

/** The accesses after a value, `a.b[0]`, none or more. */
const accesses = repeatFrom0(access)

/** A primitive value and its trivia, then its accesses. */
const primitiveValue = /** @type {const} */ ([[primitive, trivia], accesses])

/** A reference and its trivia, then its accesses. */
const reference = /** @type {const} */ ([[identifier, trivia], accesses])

/**
 * A function's body: a value, but not an object — after `=>` JavaScript
 * reads `{` as a block, never as an object, so the spelling is refused
 * rather than read another way — and not yet a block. A function takes no
 * access of its own: after `=>` an access belongs to the body.
 *
 * @type {Body}
 */
export const body = () => ['const', {
    primitive: primitiveValue,
    ref: reference,
    array: [array, accesses],
    func,
}]

/**
 * A function: one rest parameter, `(...a)`, then `=>` on the same line
 * as the `)`, as JavaScript requires, and the body, which ends with its
 * own trivia as every value does. The parameter is the arguments array,
 * and the body names it and nothing outside — which names it may use is
 * the fold's to say, since a name is a word the grammar does not see.
 *
 * @type {Func}
 */
export const func = [sym('('), trivia, sym('...'), trivia, identifier, trivia, sym(')'), sameLine, sym('=>'), trivia, body]

/**
 * A value ends with its own trivia, so that it may be followed by an
 * access, which the trivia after the value would otherwise have to lead —
 * and a rule trivia leads is a rule one symbol of lookahead cannot enter.
 * Every value's last token is followed by trivia exactly once, here, and
 * what follows a value adds none. Any value takes accesses, as any
 * expression does in JavaScript: `[1].length`, `"ab"[0]`, `{ a: 1 }.a`.
 * `1 .x` parses here too, with a space since `1.x` is one number and a
 * stray word in JavaScript, and the fold refuses it with every access on
 * a numeric literal: JavaScript reads `-1 .x` as `-(1 .x)` and the
 * tokenizer folds the minus into the number.
 *
 * @type {Value}
 */
export const value = () => ['const', {
    primitive: primitiveValue,
    ref: reference,
    array: [array, accesses],
    object: [object, accesses],
    func,
}]

/** A property name: bare identifier, string literal, or a computed `["a"]`. */
export const key = /** @type {const} */ ({
    plain: identifier,
    string: sym('string'),
    computed: [sym('['), trivia, sym('string'), trivia, sym(']')],
})

/** @type {Member} */
export const member = [key, trivia, sym(':'), trivia, value]

/** The items of an array. A rule of its own, so that a reader may map it. */
export const values = items(value)

/** The members of an object, likewise. */
export const members = items(member)

export const array = /** @type {const} */ ([sym('['), trivia, option(values), sym(']'), trivia])

export const object = /** @type {const} */ ([sym('{'), trivia, option(members), sym('}'), trivia])

/** A statement's terminator: `;`, then the trivia after it. */
const end = /** @type {const} */ ([sym(';'), trivia])

/**
 * An import's attribute, `with { type: "json" }` as JavaScript spells the
 * one attribute it defines: the key any identifier and the value any
 * string here, since the grammar sees symbols and the fold reads the words
 * — the key has to be `type` and the value `json`, and the fold says which
 * is not.
 */
export const attribute = /** @type {const} */ ([
    sym('with'), trivia, sym('{'), trivia, sym('id'), trivia, sym(':'), trivia, sym('string'), trivia, sym('}'), trivia,
])

export const importStatement = /** @type {const} */ ([
    sym('import'), trivia, identifier, trivia, sym('from'), trivia, sym('string'), trivia, option(attribute), ...end,
])

export const constStatement = /** @type {const} */ ([
    sym('const'), trivia, identifier, trivia, sym('='), trivia, value, ...end,
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
