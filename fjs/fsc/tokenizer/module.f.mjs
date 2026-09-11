/**
 * The DJS tokenizer, in layers, each an LL(1) grammar or a fold over the
 * layer below:
 *
 * ```text
 * code points ==the token grammar, one token at a time==> lexemes
 *             ==fold: trivia merged, words classified, boundaries checked==> JsToken stream
 *             ==fold: keywords demoted, `-` folded into a number==> DjsToken stream
 * ```
 *
 * The grammar is [`fjs/ebnf/lib/js`](../../ebnf/lib/js/module.f.mjs), one
 * token, read by the LL(1) backend resumed where the last token ended
 * ([`fjs/ebnf/ll1`](../../ebnf/ll1/README.md), "A token layer resumes the
 * parser"). A token's text is the input between where it began and where
 * it ended, so nothing walks its tree but the one question a block comment
 * leaves open — whether it closed — and that walk is a loop, since the
 * comment's content is right-recursive and a comment may be long.
 *
 * What the grammar leaves to the fold above it: a run of whitespace and
 * newlines is one token, `nl` where the run holds a newline and anchored
 * at the first, `ws` otherwise; a word is a keyword or an identifier; a
 * number is a `number` or a `bigint`; and a number directly followed by a
 * word or a number, no trivia between — `123abc`, `1nabc`, `00` — is the
 * error `invalid number`, at the token that should not be there. The
 * classical grammar refused those inside the number, with a branch that
 * consumed the offending character; an LL(1) grammar cannot, and the token
 * stream shows the same fact one layer up.
 *
 * An error is the whole output: the first, in document order, of the
 * boundary above, a block comment the input ends inside (`*​/ expected`,
 * from its `/*` to the end of input), a number cut short (`invalid
 * number`, at the character where digits were expected), and a token the
 * grammar refuses (`invalid token`, from where the token began to the end
 * of input). The grammar stops at the token it refuses, so the fold above
 * it runs over what came before first, and the refused token is reported
 * only where nothing before it was wrong.
 *
 * @module
 *
 * @import { ErrorToken, JsToken, JsTokenWithMetadata, TokenMetadata, TokenPosition } from '../../js/tokenizer/types.ts'
 * @import { StateScan } from '../../types/function/operator/types.ts'
 * @import { List } from '../../types/list/types.ts'
 * @import { DjsToken, DjsTokenWithMetadata } from './types.ts'
 * @import { _DjsScanState, _Failure, _Kind, _Lexed, _Lexeme, _StringDecodeState, _Trivia } from './private.ts'
 */

import { assert } from '../../asserts/module.f.mjs'
import { parser } from '../../ebnf/ll1/module.f.mjs'
import { token } from '../../ebnf/lib/js/module.f.mjs'
import { keywords } from '../../js/keywords/module.f.mjs'
import { escapeToCodePoint } from '../../js/string_escape/module.f.mjs'
import { isKeywordToken, mergeTrivia } from '../../js/tokenizer/module.f.mjs'
import {
    asterisk, lf,
    reverseSolidus,
    hexDigitValue,
    latinSmallLetterU,
} from '../../text/ascii/module.f.mjs'
import { codePointListToString, stringToCodePointList } from '../../text/utf16/module.f.mjs'
import { mapUnwrap } from '../../types/nullable/module.f.mjs'
import { concat, empty, flat, fold, map, stateScan, toArray } from '../../types/list/module.f.mjs'
import { stringifyAsTree } from '../../djs/serializer/module.f.mjs'
import { sort } from '../../types/object/module.f.mjs'

// -- layer 1: the grammar, one token at a time ------------------------------

/** The parser of one token, built once: the grammar is analysed per module, not per parse. */
const parseToken = parser(token)

/**
 * A variant's node, read untyped: its tag and the branch's node. The tree
 * is the grammar's by construction, so a shape that is not a variant's is
 * a broken invariant, not bad input.
 *
 * @type {(node: unknown) => readonly [string, unknown]}
 */
const branch = node => {
    assert(node instanceof Array && node.length === 2 && typeof node[0] === 'string', node)
    return [node[0], node[1]]
}

/** @type {(node: unknown) => readonly unknown[]} */
const items = node => {
    assert(node instanceof Array, node)
    return node
}

/**
 * Whether a block comment's content, the node after its `/*`, reached the
 * `*​/` that closes it before the input ended. Each node is a `*` and what
 * follows it, or another symbol and more content, or the end: `end` after
 * a `*` is the close, `unterminated` the end of input. A loop, not a
 * recursion — the content nests one level per symbol.
 *
 * @type {(content: unknown) => boolean}
 */
const closed = content => {
    let node = content
    for (;;) {
        const [tag, rest] = branch(node)
        switch (tag) {
            case 'end': { return true }
            case 'unterminated': { return false }
            default: { node = items(rest)[1] }
        }
    }
}

/**
 * The kind of a token from its node, and whether it closed — which is a
 * question only for a block comment, `true` for every other token. The
 * `token` variant's tag is the kind but for `slash`, whose own tag says
 * which of its four it was.
 *
 * @type {(node: unknown) => readonly [_Kind, boolean]}
 */
const kindOf = node => {
    const [tag, child] = branch(node)
    if (tag !== 'slash') { return [/** @type {_Kind} */ (tag), true] }
    const [sub, rest] = branch(items(child)[1])
    switch (sub) {
        case 'oneline': { return ['comment', true] }
        case 'multiline': { return ['comment', closed(items(rest)[1])] }
        default: { return ['operator', true] }
    }
}

// Advances path/line/column by one code point, mirroring fjs/js/tokenizer's tokenizeWithPositionOp.
/** @type {(cp: number) => (metadata: TokenMetadata) => TokenMetadata} */
const advanceMetadata = cp => metadata => cp === lf
    ? { path: metadata.path, line: metadata.line + 1, column: 1 }
    : { path: metadata.path, line: metadata.line, column: metadata.column + 1 }

/** @type {(metadata: TokenMetadata) => (cp: readonly number[]) => TokenMetadata} */
const advance = metadata => cp => fold(advanceMetadata)(metadata)(cp)

/** @type {(cp: number) => boolean} */
const isDigit = cp => cp >= 0x30 && cp <= 0x39

/**
 * Reads the whole input one token at a time, the parser resumed where the
 * last token ended, until a token the grammar refuses. A token's text is
 * the input it spans, and its position is carried along rather than
 * attached to every code point.
 *
 * @type {(path: string) => (cp: readonly number[]) => _Lexed}
 */
const lex = path => cp => {
    const symbols = cp.map(symbol => ({ symbol, meta: null }))
    /** @type {List<_Lexeme>} */
    let lexemes = empty
    let pos = 0
    /** @type {TokenMetadata} */
    let metadata = { path, line: 1, column: 1 }
    while (pos < cp.length) {
        const match = parseToken(symbols, pos)
        if (match[0] === 'error') {
            /** @type {_Failure} */
            const failure = {
                number: isDigit(cp[pos]),
                start: metadata,
                at: advance(metadata)(cp.slice(pos, match[1])),
            }
            return { lexemes: toArray(lexemes), failure, final: advance(metadata)(cp.slice(pos)) }
        }
        const [node, end] = match[1]
        const text = cp.slice(pos, end)
        const [kind, ok] = kindOf(node)
        lexemes = concat(lexemes)([{ kind, text, start: metadata, closed: ok }])
        metadata = advance(metadata)(text)
        pos = end
    }
    return { lexemes: toArray(lexemes), failure: null, final: metadata }
}

// -- layer 2: the JsToken stream --------------------------------------------

/**
 * A `\uXXXX` escape reaches the `unicode` state only after the grammar has
 * accepted its four hex digits, so a non-hex code point here is a tokenizer
 * bug rather than bad input — assert instead of decoding it to a garbage
 * value, which is what the hand-rolled ternary chain used to do.
 */
const unwrapHexDigitValue = mapUnwrap(hexDigitValue)

/** @type {StateScan<number, _StringDecodeState, List<number>>} */
const stringDecodeScan = (cp, state) => {
    switch (state.kind) {
        case 'escape': {
            const codePoint = escapeToCodePoint(cp)
            // The grammar's `string` rule only ever accepts one of the eight
            // simple escapes or `u` right after a backslash — any other
            // character fails to parse before a token reaches this scan at
            // all, so narrowing to those nine is provable, not merely
            // assumed. `u` is the one the table does not answer for: the
            // four hex digits that follow decide its meaning.
            assert(codePoint !== null || cp === latinSmallLetterU, cp)
            return codePoint === null
                ? [null, { kind: 'unicode', acc: 0, count: 0 }]  // \u → start 4 hex digits
                : [[codePoint], { kind: 'normal' }]
        }
        case 'unicode': {
            const acc = (state.acc << 4) | unwrapHexDigitValue(cp)
            return state.count === 3 ? [[acc], { kind: 'normal' }] : [null, { kind: 'unicode', acc, count: state.count + 1 }]
        }
        default:
            return cp === reverseSolidus ? [null, { kind: 'escape' }] : [[cp], { kind: 'normal' }]
    }
}

/** @type {(codePoints: readonly number[]) => string} */
const decodeJsonString = codePoints => codePointListToString(flat(stateScan(stringDecodeScan)({ kind: 'normal' })(codePoints.slice(1, -1))))

/** @type {ReadonlySet<string>} */
const keywordSet = new Set(keywords)

/**
 * The token a word is: a string decoded, a word a keyword or an identifier,
 * a number a `number` or a `bigint` by its suffix, a comment its text
 * between the marks, an operator its own spelling.
 *
 * @type {(lexeme: _Lexeme) => JsToken}
 */
const toJsToken = ({ kind, text }) => {
    const value = codePointListToString(text)
    switch (kind) {
        case 'string': { return { kind: 'string', value: decodeJsonString(text) } }
        case 'id': { return keywordSet.has(value) ? /** @type {JsToken} */ ({ kind: value }) : { kind: 'id', value } }
        case 'number': {
            return value.endsWith('n') ? { kind: 'bigint', value: BigInt(value.slice(0, -1)) } : { kind: 'number', value }
        }
        case 'comment': {
            return text[1] === asterisk
                ? { kind: '/*', value: value.slice(2, -2) }
                : { kind: '//', value: value.slice(2) }
        }
        default: { return /** @type {JsToken} */ ({ kind: value }) }
    }
}

/**
 * The position half of a `TokenMetadata` — the path is stated once, on the
 * start, because a token does not straddle files.
 *
 * @type {(metadata: TokenMetadata) => TokenPosition}
 */
const position = ({ line, column }) => ({ line, column })

/** @type {(token: JsToken, metadata: TokenMetadata) => JsTokenWithMetadata} */
const at = (token, metadata) => ({ token, metadata })

/**
 * The error the whole output becomes: a lexical failure is reported alone,
 * as the tokenizer has always reported it, with its span where it has one.
 *
 * @type {(message: ErrorToken['message'], metadata: TokenMetadata, end?: TokenMetadata) => readonly JsTokenWithMetadata[]}
 */
const failed = (message, metadata, end) => [at(end === undefined ? { kind: 'error', message } : { kind: 'error', message, end: position(end) }, metadata)]

/**
 * The token stream of a text: the tokens the grammar read, folded — a run
 * of trivia into one token, a block comment holding a newline followed by
 * an `nl`, as `fjs/js/tokenizer` emits it — and checked at the one
 * boundary the grammar cannot see, a number against the token after it.
 * The whole output is the first error where there is one.
 *
 * @type {(input: List<number>) => (path: string) => List<JsTokenWithMetadata>}
 */
export const tokenizeJs = input => path => {
    const { lexemes, failure, final } = lex(path)(toArray(input))
    /** @type {List<JsTokenWithMetadata>} */
    let out = empty
    /** @type {_Trivia} */
    let trivia = null
    /** @type {_Kind | null} */
    let previous = null
    for (const lexeme of lexemes) {
        const { kind, start } = lexeme
        if (kind === 'ws' || kind === 'newLine') {
            // A run of trivia is one token, and its kind is decided by the
            // run: a newline anywhere makes it `nl`, anchored at that newline,
            // which is why the pending token restarts under the incoming kind
            // when that kind is not the one it already has.
            const incoming = kind === 'ws' ? 'ws' : 'nl'
            trivia = trivia !== null && mergeTrivia(trivia.kind, incoming) === trivia.kind
                ? trivia
                : { kind: incoming, metadata: start }
            previous = null
            continue
        }
        if (trivia !== null) {
            out = concat(out)([at({ kind: trivia.kind }, trivia.metadata)])
            trivia = null
        }
        if (kind === 'comment' && !lexeme.closed) {
            // from the `/*` that was never closed to where the input ran out
            return failed('*/ expected', start, final)
        }
        if (previous === 'number' && (kind === 'id' || kind === 'number')) {
            // ECMAScript disallows a numeric literal immediately followed by
            // an identifier start or a digit — `123abc`, `1nabc`, `00`. The
            // anchor is the token that should not be there, not the number's
            // start, and there is no end for the same reason: the span a
            // reader would want runs backwards from the anchor.
            return failed('invalid number', start)
        }
        const jsToken = toJsToken(lexeme)
        out = concat(out)([at(jsToken, start)])
        if (jsToken.kind === '/*' && (jsToken.value.includes('\n') || jsToken.value.includes('\r'))) {
            out = concat(out)([at({ kind: 'nl' }, start)])
        }
        previous = kind
    }
    if (failure !== null) {
        // The token the grammar refused comes after every token it read,
        // so an error among those — the fold above has just looked — is
        // reported first, and this one only where nothing came before it.
        // A number that stands directly against the number before it is
        // that boundary error, wherever it then failed: `01.` is refused at
        // the `1`. A number cut short — `1.`, `0e` — fails where its digits
        // were expected, and that character is the one to point at, with
        // no end, since what is wrong runs backwards from there. Any other
        // token is refused whole, from where it began to the end of input:
        // nothing past a lexical failure is tokenized.
        return failure.number
            ? failed('invalid number', previous === 'number' ? failure.start : failure.at)
            : failed('invalid token', failure.start, final)
    }
    if (trivia !== null) {
        out = concat(out)([at({ kind: trivia.kind }, trivia.metadata)])
    }
    return concat(out)([at({ kind: 'eof' }, final)])
}

const stringify = stringifyAsTree(sort)

/**
 * The tokens of a text as one string, positions left out — `error` where
 * the text does not tokenize.
 *
 * @type {(s: string) => string}
 */
export const tokenizeString = s => {
    const tokens = toArray(tokenizeJs(stringToCodePointList(s))(''))
    return tokens.some(({ token }) => token.kind === 'error')
        ? 'error'
        : stringify(tokens.map(({ token }) => token))
}

// -- layer 3: the DjsToken stream -------------------------------------------

/** @type {(input: JsToken) => List<DjsToken>} */
const mapDjsToken = input => {
    switch (input.kind) {
        case 'id':
        case 'bigint':
        case '{':
        case '}':
        case ':':
        case ',':
        case '[':
        case ']':
        case '.':
        case '=':
        case ';':
        case 'true':
        case 'false':
        case 'null':
        case 'string':
        case 'number':
        case 'ws':
        case 'nl':
        case 'undefined':
        case '//':
        case '/*':
        case 'eof':
        case 'error': return [input]
        default: return isKeywordToken(input) ? [{ kind: 'id', value: input.kind }] : [{ kind: 'error', message: 'invalid token' }]
    }
}

/** @type {(input: JsToken) => readonly [List<DjsToken>, _DjsScanState]} */
const parseDjsDefaultState = input => {
    switch (input.kind) {
        case 'eof': return [[{ kind: 'eof' }], { kind: 'def' }]
        case '-': return [empty, { kind: '-' }]
        default: return [mapDjsToken(input), { kind: 'def' }]
    }
}

// Folds a leading '-' into the following number/bigint token, mirroring the old
// fjs/fsc/tokenizer's minus-state exactly.
//
// No `case '-'` here: the grammar reads two adjacent `-` characters as the
// single `'--'` token (the decrement operator), so this state — entered only
// after a single `-` — can never itself see another `'-'`-kind input. Such an
// input falls through to `default`, which handles it exactly like any other
// non-number/bigint/eof token.
/** @type {(input: JsToken) => readonly [List<DjsToken>, _DjsScanState]} */
const parseDjsMinusState = input => {
    switch (input.kind) {
        case 'eof': return [[{ kind: 'error', message: 'invalid token' }, { kind: 'eof' }], { kind: 'def' }]
        case 'bigint': return [[{ kind: 'bigint', value: -1n * input.value }], { kind: 'def' }]
        // negation is lexical: the minus sign joins the lexeme, so the token
        // stays the exact source text of the number.
        case 'number': return [[{ kind: 'number', value: `-${input.value}` }], { kind: 'def' }]
        default: return [{ first: { kind: 'error', message: 'invalid token' }, tail: mapDjsToken(input) }, { kind: 'def' }]
    }
}

/** @type {StateScan<JsToken, _DjsScanState, List<DjsToken>>} */
const scanDjsToken = (input, state) => {
    switch (state.kind) {
        case '-': return parseDjsMinusState(input)
        default: return parseDjsDefaultState(input)
    }
}

/** @type {(metadata: TokenMetadata) => (token: DjsToken) => DjsTokenWithMetadata} */
const mapDjsTokenWithMetadata = metadata => token => ({ token, metadata })

/** @type {StateScan<JsTokenWithMetadata, _DjsScanState, List<DjsTokenWithMetadata>>} */
const scanDjsTokenWithMetadata = (input, state) => {
    const [djsTokens, newState] = scanDjsToken(input.token, state)
    return [map(mapDjsTokenWithMetadata(input.metadata))(djsTokens), newState]
}

/** @type {(input: List<number>) => (path: string) => List<DjsTokenWithMetadata>} */
export const tokenize = input => path => flat(stateScan(scanDjsTokenWithMetadata)({ kind: 'def' })(tokenizeJs(input)(path)))
