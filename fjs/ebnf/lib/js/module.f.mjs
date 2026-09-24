/**
 * The JavaScript token grammar: one token, as the djs tokenizer reads them,
 * spelled LL(1) for `../../ll1`. A file is not `repeatFrom0(token)` — in a
 * whole-file grammar a token's follow set is the next token's first set, so
 * every greedy token is a first/follow conflict — but one token at a time,
 * the parser resumed where the last token ended (`../../ll1`, "A token
 * layer resumes the parser"). Nothing follows a token here, and that is
 * what makes the grammar LL(1).
 *
 * Beside the classical grammar in `fjs/fsc/tokenizer`, which the
 * backtracking backend read, four things are spelled differently, each
 * a conflict measured before the port and recorded in `fjs/fsc/README.md`
 * ("Both grammars are LL(1)"):
 *
 * - the block comment's `*` is left-factored: after a `*`, a `/` is the
 *   end, another `*` is looked at again, and anything else is content;
 * - the `/` shared by a comment and the division operator is one rule,
 *   {@link slash}, deciding on the symbol after it;
 * - the operators are a prefix tree, {@link operator}, built by
 *   `literals` from the list;
 * - a number has no poison branch: `123abc` reads as the number `123`
 *   followed by the identifier `abc`, and the layer above the tokens
 *   refuses the two for standing side by side, as that record says.
 *
 * A string is JSON's, or JSON's spelled between single quotes
 * ({@link string}), and a number's unsigned part with its fraction and
 * exponent is JSON's: the rules are imported from `../json`, not
 * restated. A line comment stops before its newline, which is the next
 * token; the classical grammar swallows it and splits it back out below
 * the grammar. Whitespace is one symbol per token, as it is there.
 *
 * @module
 *
 * @import { AfterStar, Content, TriviaKind } from './types.ts'
 */

import { literals, range, remove, repeatFrom0, set, union, unicodeMax } from '../../module.f.mjs'
import { digit, escape, optionFloatSuffix, string as jsonString, uint } from '../json/module.f.mjs'

/** Every symbol of the alphabet: a code point. */
const any = range(`\0${unicodeMax}`)

/** One whitespace symbol; a run of them is a run of tokens. */
export const ws = set(' \t')

/**
 * The four line terminators ECMAScript names, its `LineTerminator`: line
 * feed, carriage return, and the Unicode line and paragraph separators.
 * The grammar reads the first two as newlines and admits the separators
 * in a string literal alone, as JSON does: outside one they are no token,
 * since an invisible line break is no line break here. A comment ends
 * where JavaScript's ends, at any of the four, so what a separator would
 * begin is never read as comment text — the separator is the error.
 */
export const lineTerminators = /**@type {const}*/(['\n', '\r', '\u2028', '\u2029'])

/** The two line terminators that are not a newline here, and no token either. */
const separators = set('\u2028\u2029')

/** One newline symbol. */
export const newLine = set('\n\r')

/**
 * The rule above the grammar for the trivia it reads one symbol at a time:
 * a maximal run of whitespace and newlines is one token, and the run is
 * `nl` if it holds any newline — equal kinds coalesce, `nl` absorbs `ws`.
 * Stated once, here, so that every reader of the grammar folds by the same
 * rule rather than each restating it with only the proofs to catch a drift.
 *
 * @type {(a: TriviaKind, b: TriviaKind) => TriviaKind}
 */
export const mergeTrivia = (a, b) => a === 'nl' || b === 'nl' ? 'nl' : 'ws'

const idStart = /**@type {const}*/({
    smallLetter: range('az'),
    bigLetter: range('AZ'),
    lowLine: '_',
    dollarSign: '$',
})

const idChar = /**@type {const}*/({ ...idStart, digit })

/**
 * An escape inside a single-quoted string: JSON's, whose simple escapes
 * gain `\'` — the one character the delimiter makes necessary to escape,
 * as `\"` is inside `"…"`. The rest of JavaScript's escapes are not
 * FunctionalScript's (`spec/todo/2460-js-string-literals.md`).
 */
const singleQuoteEscape = /**@type {const}*/([escape[0], { ...escape[1], c: union(escape[1].c, set("'")) }])

/**
 * A string between single quotes: JSON's string with the delimiters
 * swapped, so a `"` stands for itself and a `'` is escaped.
 */
const singleQuoted = /**@type {const}*/(["'", repeatFrom0({
    c: remove(range(` ${unicodeMax}`), set("'\\")),
    escape: singleQuoteEscape,
}), "'"])

/**
 * A string: JSON's, between double quotes, or the same between single
 * quotes. Both denote the value their characters and escapes spell; which
 * quote was used is a spelling, and the token does not keep it.
 */
export const string = /**@type {const}*/({ double: jsonString, single: singleQuoted })

/** An identifier, or a keyword: the words are told apart above the grammar. */
export const id = /**@type {const}*/([idStart, repeatFrom0(idChar)])

/**
 * A number: JSON's unsigned integer, then either the bigint suffix or
 * JSON's optional fraction and exponent. The sign is an operator token.
 */
export const number = /**@type {const}*/([uint, { bigint: 'n', real: optionFloatSuffix }])

const notNewLine = remove(any, set(lineTerminators.join('')))

const notStar = remove(remove(any, set('*')), separators)

const notStarSlash = remove(remove(any, set('*/')), separators)

/**
 * What follows a `*` inside a block comment: `/` ends the comment, another
 * `*` is looked at the same way, anything else is content — and the end
 * of input leaves the comment unterminated, which the tag says.
 *
 * @type {AfterStar}
 */
const afterStar = () => ['const', {
    end: '/',
    star,
    other: [notStarSlash, content],
    unterminated: '',
}]

/**
 * The content of a block comment after its `/*`, up to and including the
 * `*​/` that ends it — or to the end of input, tagged `unterminated`.
 *
 * @type {Content}
 */
export const content = () => ['const', {
    star,
    other: [notStar, content],
    unterminated: '',
}]

const star = /**@type {const}*/(['*', afterStar])

/**
 * Every token that begins with `/`: a line comment, a block comment, the
 * `/=` operator, and division — one rule, so that one symbol of lookahead
 * decides among them.
 */
export const slash = /**@type {const}*/(['/', {
    oneline: ['/', repeatFrom0(notNewLine)],
    multiline: ['*', content],
    assign: '=',
    divide: '',
}])

/**
 * The operators the classical grammar names, less the two that begin with
 * `/`, which {@link slash} holds.
 */
export const operators = /**@type {const}*/([
    '...', '.', '=>', '===', '==', '=', '!==', '!=', '!',
    '>>>=', '>>>', '>>=', '>>', '>=', '>', '<<=', '<<', '<=', '<',
    '+=', '++', '+', '-=', '--', '-', '**=', '**', '*=', '*', '%=', '%',
    '&&=', '&&', '&=', '&', '||=', '||', '|=', '|', '^=', '^', '~',
    '??=', '??', '?.', '?',
    '[', ']', '{', '}', '(', ')', ',', ':', ';',
])

/** The operators as a prefix tree: the longest the lookahead leads to. */
export const operator = literals(operators)

/**
 * One token. Its node is the branch taken, tagged by kind — `slash`'s
 * own tag says which of its four it was — and the token's text is the
 * symbols under the node.
 */
export const token = /**@type {const}*/({ number, string, id, slash, operator, ws, newLine })
