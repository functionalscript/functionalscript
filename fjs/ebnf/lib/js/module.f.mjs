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
 * A string is JSON's, and so is a number's unsigned part with its
 * fraction and exponent: the rules are imported from `../json`, not
 * restated. A line comment stops before its newline, which is the next
 * token; the classical grammar swallows it and splits it back out below
 * the grammar. Whitespace is one symbol per token, as it is there.
 *
 * @module
 *
 * @import { AfterStar, Content, TriviaKind } from './types.ts'
 */

import { literals, range, remove, repeatFrom0, set, unicodeMax } from '../../module.f.mjs'
import { digit, optionFloatSuffix, string, uint } from '../json/module.f.mjs'

/** Every symbol of the alphabet: a code point. */
const any = range(`\0${unicodeMax}`)

/** One whitespace symbol; a run of them is a run of tokens. */
export const ws = set(' \t')

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

/** An identifier, or a keyword: the words are told apart above the grammar. */
export const id = /**@type {const}*/([idStart, repeatFrom0(idChar)])

/**
 * A number: JSON's unsigned integer, then either the bigint suffix or
 * JSON's optional fraction and exponent. The sign is an operator token.
 */
export const number = /**@type {const}*/([uint, { bigint: 'n', real: optionFloatSuffix }])

const notNewLine = remove(any, newLine)

const notStar = remove(any, set('*'))

const notStarSlash = remove(any, set('*/'))

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
    '.', '=>', '===', '==', '=', '!==', '!=', '!',
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
