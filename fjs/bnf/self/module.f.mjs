/**
 * The original Backus-Naur Form metasyntax, described by itself using this
 * package's own functional grammar representation (`fjs/bnf/module.f.mjs`).
 *
 * Transcribed from the canonical BNF-of-BNF grammar:
 * https://en.wikipedia.org/wiki/Backus%E2%80%93Naur_form#Further_examples
 *
 * Two rules of the original are rewritten to an equivalent right-recursive
 * (or iterative) shape, because this package's backends are recursive
 * descent / LL(1) and cannot match left recursion:
 *
 * - `<rule-name> ::= <letter> | <rule-name> <rule-char>` becomes
 *   `<letter> <rule-char>*`.
 * - `<line-end> ::= <opt-whitespace> <EOL> | <line-end> <line-end>` becomes
 *   one or more repetitions of `<opt-whitespace> <EOL>`.
 *
 * Both rewrites accept exactly the same language as the original.
 *
 * A third deviation is not a left-recursion fix but a correction: the
 * canonical `<symbol>` production includes both quote characters, which —
 * fed into this package's greedy, ordered-choice matcher — makes a quoted
 * literal swallow its own closing quote (see the comment on `symbol` below).
 * Both quote characters are left out of `symbol` here and added back only by
 * the `character1` / `character2` rule that needs each one, which is what
 * those two rules already exist to do.
 *
 * @module
 *
 * @import { Rule } from '../types.ts'
 */

import { range, repeat0Plus, repeat1Plus, set } from '../module.f.mjs'

// <syntax> ::= <rule> | <rule> <syntax>
/** @type {Rule} */
export const syntax = () => repeat1Plus(rule)

// <rule> ::= <opt-whitespace> "<" <rule-name> ">" <opt-whitespace> "::="
//              <opt-whitespace> <expression> <line-end>
/** @type {Rule} */
const rule = () =>
    [optWhitespace, '<', ruleName, '>', optWhitespace, '::=', optWhitespace, expression, lineEnd]

// <opt-whitespace> ::= " " <opt-whitespace> | ""
/** @type {Rule} */
const optWhitespace = repeat0Plus(' ')

// <expression> ::= <list> | <list> <opt-whitespace> "|" <opt-whitespace> <expression>
//
// This backend is greedy, ordered-choice (PEG-style): a branch that succeeds
// and consumes input wins immediately, with no backtracking into a later
// branch that could have consumed more. `or` therefore has to be tried before
// the plain `list` it starts with, or a `list` alone would always win and the
// parse would stop at the first alternative instead of continuing past `|`.
/** @type {Rule} */
const expression = () => ({
    or: [list, optWhitespace, '|', optWhitespace, expression],
    list,
})

/** @type {Rule} */
const eol = {
    lf: '\n',
    crlf: ['\r', '\n'],
}

// <line-end> ::= <opt-whitespace> <EOL> | <line-end> <line-end>
/** @type {Rule} */
const lineEnd = repeat1Plus([optWhitespace, eol])

// <list> ::= <term> | <term> <opt-whitespace> <list>
//
// Same ordered-choice reason as `expression`: try consuming another term
// before settling for just one.
/** @type {Rule} */
const list = () => ({
    more: [term, optWhitespace, list],
    term,
})

// <term> ::= <literal> | "<" <rule-name> ">"
/** @type {Rule} */
const term = () => ({
    literal,
    nonTerminal: ['<', ruleName, '>'],
})

// <literal> ::= '"' <text1> '"' | "'" <text2> "'"
/** @type {Rule} */
const literal = () => ({
    double: ['"', text1, '"'],
    single: ["'", text2, "'"],
})

// <letter> ::= "A" | "B" | ... | "Z" | "a" | "b" | ... | "z"
/** @type {Rule} */
const letter = {
    upper: range('AZ'),
    lower: range('az'),
}

// <digit> ::= "0" | "1" | ... | "9"
/** @type {Rule} */
const digit = range('09')

// <symbol> ::= "|" | " " | "!" | "#" | "$" | "%" | "&" | "(" | ")" | "*" | "+"
//   | "," | "-" | "." | "/" | ":" | ";" | ">" | "=" | "<" | "?" | "@" | "["
//   | "\" | "]" | "^" | "_" | "`" | "{" | "}"
//
// The two quote characters are deliberately left out here — each is instead
// added back by exactly one of `character1` / `character2` below, the one
// belonging to the text it delimits. A `symbol` that included both quote
// characters would make `character` match either quote, and since a greedy
// ordered-choice engine tries `character` before the dedicated quote branch,
// `text1`/`text2` would then swallow their own closing quote as content
// instead of stopping there.
/** @type {Rule} */
const symbol = set('| !#$%&()*+,-./:;>=<?@[\\]^_`{}')

// <character> ::= <letter> | <digit> | <symbol>
/** @type {Rule} */
const character = () => ({
    letter,
    digit,
    symbol,
})

// <character1> ::= <character> | "'"
/** @type {Rule} */
const character1 = () => ({
    character,
    quote: "'",
})

// <character2> ::= <character> | '"'
/** @type {Rule} */
const character2 = () => ({
    character,
    quote: '"',
})

// <text1> ::= "" | <character1> <text1>
/** @type {Rule} */
const text1 = repeat0Plus(character1)

// <text2> ::= "" | <character2> <text2>
/** @type {Rule} */
const text2 = repeat0Plus(character2)

// <rule-name> ::= <letter> <rule-char>*  (see the module comment: this is the
// left-recursion-free rewrite of `<rule-name> ::= <letter> | <rule-name> <rule-char>`)
/** @type {Rule} */
const ruleName = () => [letter, repeat0Plus(ruleChar)]

// <rule-char> ::= <letter> | <digit> | "-"
/** @type {Rule} */
const ruleChar = () => ({
    letter,
    digit,
    dash: '-',
})
