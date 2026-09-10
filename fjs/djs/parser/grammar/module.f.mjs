/**
 * The djs module grammar over token symbols, spelled LL(1) for
 * `fjs/ebnf/ll1`, beside the classical grammar in `../module.f.mjs` that
 * the backtracking backend reads:
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
 * Three things are spelled differently from the classical grammar, each a
 * conflict `../../todo/ebnf-ll1-port.md` measured:
 *
 * - **Trivia follows a token, never leads a rule.** Every token is
 *   followed by `t`, so no rule begins with trivia and no two branches
 *   begin with it; the classical grammar's statement terminator and the
 *   module's final optional `;` both did.
 * - **`;` ends every statement, the export included.** The newline
 *   terminator is gone: it is the design `todo/parser-serializer-restructure.md`
 *   decided for FunctionalScript (stage 5), it is what DataJS requires,
 *   and deciding between a newline and a `;` reached through newlines
 *   took unbounded lookahead.
 * - **A list is right-recursive.** After an item and its comma, one
 *   symbol of lookahead says whether an item or the closing bracket
 *   follows, so a trailing comma is a comma nothing follows; the classical
 *   grammar rested it on a failed repetition round rewinding.
 *
 * The alphabet is the classical parser's own, `_ordinaryTokenNames` in
 * `../module.f.mjs` — one name per token kind, the five framing keywords
 * with names of their own, since the tokenizer emits them as identifiers —
 * encoded by `fjs/ebnf/token_symbol`; `eof` has none, since the backend
 * synthesizes the end of input. A symbol is a rule of one symbol, so a
 * terminal is the symbol a token is encoded to and nothing else. The port
 * turns the import around: the names move here, and the parser reads them
 * from the grammar.
 *
 * @module
 *
 * @import { Meta } from '../../../ebnf/ast/types.ts'
 * @import { Rule } from '../../../ebnf/types.ts'
 * @import { DjsTokenWithMetadata } from '../../tokenizer/types.ts'
 * @import { _OrdinaryTokenName } from '../types.ts'
 * @import { Items, Member, Value } from './types.ts'
 */

import { assert } from '../../../asserts/module.f.mjs'
import { eof, option, repeatFrom0 } from '../../../ebnf/module.f.mjs'
import { encoding } from '../../../ebnf/token_symbol/module.f.mjs'
import { _framingKeywords as framingKeywords, _ordinaryTokenNames as names } from '../module.f.mjs'

const alphabet = encoding(names)

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
    const keyword = token.kind === 'id' ? framingKeywords.find(k => k === token.value) : undefined
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

export const array = /** @type {const} */ ([sym('['), trivia, option(items(value)), sym(']')])

export const object = /** @type {const} */ ([sym('{'), trivia, option(items(member)), sym('}')])

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
