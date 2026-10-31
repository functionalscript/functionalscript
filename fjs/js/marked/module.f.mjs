/**
 * JavaScript and TypeScript text as marked runs, found by tokenizing: the
 * fallback for text no producer marked, such as a code fence in a README,
 * and the oracle a producer that marks is held to. What marked text is, and
 * why: [`fjs/text/marked`](../../text/marked/README.md), which stays
 * language-independent; this is the JavaScript reading of it.
 *
 * **It reads the text with the real tokenizer**, [`tokenizer`](../tokenizer/module.f.mjs),
 * not with a lookalike, so a string that holds `//` is a string and a
 * keyword is whatever [`isKeyword`](../keywords/module.f.js) says, and
 * a literal word is one of its `literalWords`.
 *
 * **A text the tokenizer refuses has no spans.** Colouring the tokens before
 * the failure and not after would suggest the text is partly valid.
 *
 * **TypeScript is JavaScript's tokens with more keywords.** {@link tsSpansOf}
 * reads TypeScript's own words — `type`, `readonly`, `as`, `keyof` and the
 * rest — as keywords where an operand follows them on their line, and as
 * names everywhere else, so a variable named `type` stays a name. The
 * primitive type names, `string` among them, stay names: one is a keyword
 * only where a type stands, which takes a parser to know.
 *
 * @module
 *
 * @import { JsToken } from '../../ebnf/lib/js/types.ts'
 * @import { Scan, StateScan } from '../../types/function/operator/types.ts'
 * @import { Marked, Span, TokenKind } from '../../text/marked/types.ts'
 */

import { isTrivia } from '../../ebnf/lib/js/module.f.mjs'
import { _positions, tokenize } from '../tokenizer/module.f.mjs'
import { assertNotNullish } from '../../asserts/module.f.js'
import { isKeyword, literalWords } from '../keywords/module.f.js'
import { stringToCodePointList } from '../../text/utf16/module.f.mjs'
import { toText } from '../../text/marked/module.f.mjs'
import { scan, stateScan } from '../../types/list/module.f.js'
import { toArray } from '../../types/list/alt/module.f.js'

/**
 * Whether a name is a keyword where it stands, given the token after it on
 * its line, trivia skipped, or `null` where the line ends first. JavaScript
 * reads every name as a name.
 *
 * @type {(word: string, next: JsToken | null) => boolean}
 */
const jsContextual = () => false

/**
 * TypeScript's keywords that JavaScript reads as names: the modifiers and
 * operators of its type language. `interface`, `implements`, `private` and
 * the like are reserved in JavaScript already. The primitive type names,
 * `string` and `number` among them, are not here: one is a keyword only
 * where a type stands, which a token's neighbours cannot tell.
 */
const tsWords = ['abstract', 'accessor', 'as', 'asserts', 'declare', 'global', 'infer', 'is',
    'keyof', 'module', 'namespace', 'out', 'override', 'readonly', 'satisfies', 'type', 'unique']

/** The words that join two operands: a name before one is an operand. */
const operatorWords = ['as', 'extends', 'in', 'instanceof', 'is', 'of', 'satisfies']

/**
 * A TypeScript word is a keyword where an operand follows it on its line
 * with no operator between: a name or a keyword other than
 * {@link operatorWords}, a string, a `{`, and for `readonly` a `[`.
 * JavaScript never sets two operands side by side, so a variable named
 * `type`, followed by `=`, `,`, `.` or the line's end, stays a name.
 *
 * @type {typeof jsContextual}
 */
const tsContextual = (word, next) => {
    if (!tsWords.includes(word) || next === null) { return false }
    if (next.kind === 'id') { return !operatorWords.includes(next.value) }
    const { kind } = next
    if (isKeyword(kind)) { return !operatorWords.includes(kind) }
    return kind === 'string' || kind === '{' || (word === 'readonly' && kind === '[')
}

/**
 * The kind of a token, or `undefined` for one that stays plain.
 *
 * @type {(contextual: typeof jsContextual) => (token: JsToken, next: JsToken | null) => TokenKind | undefined}
 */
const kindOf = contextual => (token, next) => {
    const { kind } = token
    switch (kind) {
        case 'id': return contextual(token.value, next) ? 'keyword' : 'identifier'
        case 'string': return 'string'
        case 'number': case 'bigint': return 'number'
        case '//': case '/*': return 'comment'
        default: return literalWords.some(word => word === kind) ? 'literal' : isKeyword(kind) ? 'keyword' : undefined
    }
}

/**
 * The spans the tokenizer finds in `text`: none if it refuses the text, as
 * colouring the tokens before a failure would suggest the text is partly
 * valid.
 *
 * The tokenizer keeps a token's value, not its spelling (`'a'` and `"a"` are
 * one string), so a token's text is cut from the input between its start and
 * the next token's, less trailing blanks: it anchors a run of trivia that
 * holds a newline at the newline, so the blanks before it fall in the
 * previous token's cut.
 *
 * **A word after `.` or `?.` is a property name**, `x.true` and `x.default`,
 * and an `identifier` whatever it spells: the tokenizer reads it as the word
 * it spells, which the language does not mean there.
 *
 * @type {(contextual: typeof jsContextual) => (text: string) => readonly Span[]}
 */
const spansWith = contextual => text => {
    // code points, not UTF-16 units, so that an offset counts what `Span` does
    const input = toArray(stringToCodePointList(text))
    const tokens = toArray(tokenize(input)(''))
    if (tokens.some(({ token }) => token.kind === 'error')) { return [] }
    const symbols = Array.from(text)
    // Where a position is, by the fold that positioned the tokens, so the
    // lines are counted as the tokenizer counts them. The LF of a CRLF takes
    // the position of the character after it, which is the one a token
    // starts at, so the later index wins.
    const indexOf = new Map(_positions('')(input).map(({ line, column }, i) => [`${line}:${column}`, i]))
    const starts = tokens.map(({ metadata: { line, column } }) => assertNotNullish(indexOf.get(`${line}:${column}`), 'a token at no position'))
    // A token that starts where the previous one does adds nothing to cut:
    // the `nl` a block comment with a newline is followed by.
    // The token after each on its line, trivia skipped, read from the end.
    /** @type {StateScan<JsToken, JsToken | null, JsToken | null>} */
    const ahead = (token, next) => [next, token.kind === 'nl' ? null : isTrivia(token.kind) ? next : token]
    const following = toArray(stateScan(ahead)(null)(tokens.map(({ token }) => token).toReversed())).toReversed()
    const kept = tokens.flatMap(({ token }, i) => i > 0 && starts[i] === starts[i - 1] ? [] : [{ token, start: starts[i], next: following[i] }])
    // The kind of the word before each token, trivia skipped, in one pass.
    /** @type {StateScan<{ token: JsToken }, string, string>} */
    const word = ({ token }, prior) => [prior, isTrivia(token.kind) ? prior : token.kind]
    const afterWords = toArray(stateScan(word)('')(kept))
    // The last token is `eof`, which stays plain, so every token that has a
    // kind has a next one to end at.
    return kept.slice(0, -1).flatMap(({ token, start, next }, i) => {
        const kind = kindOf(contextual)(token, next)
        const before = afterWords[i]
        const property = (kind === 'keyword' || kind === 'literal') && (before === '.' || before === '?.')
        return kind === undefined ? [] : [{ start, length: Array.from(symbols.slice(start, kept[i + 1].start).join('').trimEnd()).length, kind: property ? 'identifier' : kind }]
    })
}

/**
 * The spans the tokenizer finds in JavaScript `text`, as {@link spansWith}
 * reads it.
 *
 * @type {(text: string) => readonly Span[]}
 */
export const spansOf = spansWith(jsContextual)

/**
 * The spans in TypeScript `text`: JavaScript's, with TypeScript's own
 * keywords where an operand follows them (`type X`, `readonly x`,
 * `as const`, `import type {`).
 *
 * @type {(text: string) => readonly Span[]}
 */
export const tsSpansOf = spansWith(tsContextual)

/** The starting offset before each run's length. @type {(at: number) => Scan<number, number>} */
const before = at => length => [at, before(at + length)]

/**
 * Where a producer's markup and the tokenizer part ways, or `null` where
 * they agree: the marked runs, as spans of the whole text, are the spans
 * the tokenizer finds in it, one for one. The tokenizer reads `-0` as a
 * prefix and a number, so a leading `-` is not part of the span it finds.
 * This comparison deliberately excludes that sign; it does not prove pixel
 * equality with the fallback. `render` honours the producer's whole run,
 * including the sign, as the rendering proof and design record specify.
 * What a producer marks, this holds it to; the proofs of the producers that
 * mark ask it of every example they have.
 *
 * @type {(marked: Marked) => string | null}
 */
export const disagreement = marked => {
    const text = toText(marked)
    const found = JSON.stringify(spansOf(text))
    const lengths = marked.map(([chunk]) => Array.from(chunk).length)
    const starts = toArray(scan(before(0))(lengths))
    /** @type {readonly Span[]} */
    const given = marked.flatMap(([chunk, kind], i) => {
        const dash = chunk.startsWith('-') ? 1 : 0
        return kind === undefined ? [] : [{ start: starts[i] + dash, length: lengths[i] - dash, kind }]
    })
    const marks = JSON.stringify(given)
    return marks === found ? null : `marked ${marks}, the tokenizer finds ${found}, in ${text}`
}
