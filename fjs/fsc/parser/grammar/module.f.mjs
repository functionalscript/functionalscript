/**
 * The djs module grammar over token symbols, spelled LL(1) for
 * `fjs/ebnf/ll1`, which `../module.f.mjs` reads a module with:
 *
 * ```text
 * module ::= t import* const* export eof
 * import ::= 'import' t id t 'from' t string t ';' t
 * const  ::= 'const' t id t '=' t value t ';' t
 * export ::= 'export' t 'default' t value t ';' t
 * value  ::= primitive | id | array | object
 * array  ::= '[' t [ items(value) ] ']'
 * object ::= '{' t [ items(member) ] '}'
 * member ::= key t ':' t value
 * key    ::= id | string | '[' t string t ']'
 * items  ::= item t [ ',' t [ items ] ]
 * t      ::= (ws | nl | comment)*
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
 *   not: it is the design `todo/parser-serializer-restructure.md`
 *   decided for FunctionalScript (stage 5), it is what DataJS requires,
 *   and deciding between a newline and a `;` reached through newlines
 *   took unbounded lookahead.
 * - **A list is right-recursive.** After an item and its comma, one
 *   symbol of lookahead says whether an item or the closing bracket
 *   follows, so a trailing comma is a comma nothing follows; the classical
 *   grammar rested it on a failed repetition round rewinding.
 *
 * The alphabet is {@link _ordinaryTokenNames}: one name per token kind,
 * and the five framing keywords with names of their own, since the
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
 * @import { Items, Member, Value } from './types.ts'
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
 * vocabulary: only eight punctuators survive into `DjsToken`, so the JS
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
    '{', '}', ':', ',', '[', ']', '.', '=', ';',
    'string', 'number', 'error', 'id', 'bigint',
    'ws', 'nl', '//', '/*',
])

/**
 * The framing keywords, which the tokenizer emits as `id` tokens carrying
 * the word in `value`. Kept as its own list because {@link symbolOf} has to
 * recognize exactly these values, not merely encode them.
 *
 * **A grammar over this alphabet owes them an identifier rule.** None of the
 * five is reserved: outside the framing positions a module accepts them as
 * ordinary identifiers, so `const export = 1;`, `export default export;`
 * and `{ from: 2, default: 3 }` all parse. Once each carries its own
 * symbol, a rule whose identifier terminal is the bare `id` symbol rejects
 * every one of them, which is what {@link identifier} is for.
 *
 * Giving a word its own symbol narrows where it is *required*, never where
 * it is *allowed*.
 */
export const _framingKeywords = /** @type {const} */ (['import', 'const', 'export', 'default', 'from'])

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

/** Every word that may stand where an identifier is expected: none of the framing keywords is reserved. */
export const identifier = /** @type {const} */ ({
    id: sym('id'),
    import: sym('import'),
    const: sym('const'),
    export: sym('export'),
    default: sym('default'),
    from: sym('from'),
})

/** A value that is one token. */
export const primitive = /** @type {const} */ ({
    null: sym('null'),
    true: sym('true'),
    false: sym('false'),
    undefined: sym('undefined'),
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
    const list = () => ['const', [item, trivia, option([sym(','), trivia, option(list)])]]
    return list
}

/** @type {Value} */
export const value = () => ['const', { primitive, ref: identifier, array, object }]

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

export const array = /** @type {const} */ ([sym('['), trivia, option(values), sym(']')])

export const object = /** @type {const} */ ([sym('{'), trivia, option(members), sym('}')])

/** A statement's terminator: `;`, then the trivia after it. */
const end = /** @type {const} */ ([sym(';'), trivia])

export const importStatement = /** @type {const} */ ([
    sym('import'), trivia, identifier, trivia, sym('from'), trivia, sym('string'), trivia, ...end,
])

export const constStatement = /** @type {const} */ ([
    sym('const'), trivia, identifier, trivia, sym('='), trivia, value, trivia, ...end,
])

export const exportStatement = /** @type {const} */ ([
    sym('export'), trivia, sym('default'), trivia, value, trivia, ...end,
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
