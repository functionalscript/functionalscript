/**
 * Experimental DJS parser implementation.
 *
 * @module
 *
 * @import { Ast, AstSequence, AstTag } from '../../bnf/matcher/types.ts'
 * @import {
 *   CodePointMeta,
 *   DescentMatch,
 *   DescentMatchResult,
 * } from '../../bnf/descent/types.ts'
 * @import { DataRule, Rule } from '../../bnf/types.ts'
 * @import {
 *   BigIntToken,
 *   CommentToken,
 *   EofToken,
 *   ErrorToken,
 *   IdToken,
 *   JsToken,
 *   JsTokenWithMetadata,
 *   NewLineToken,
 *   NumberToken,
 *   StringToken,
 *   TokenMetadata,
 *   WhitespaceToken,
 * } from '../../js/tokenizer/types.ts'
 * @import { CodePoint } from '../../text/utf16/types.ts'
 * @import { StateScan } from '../../types/function/operator/types.ts'
 * @import { List } from '../../types/list/types.ts'
 * @import { DjsToken, DjsTokenWithMetadata } from './types.ts'
 * @import { TriviaKind } from '../../js/tokenizer/types.ts'
 * @import { Nullable } from '../../types/nullable/types.ts'
 */

import { assert, assertEq } from '../../asserts/module.f.mjs'
import { descentParserRuleSet } from '../../bnf/descent/module.f.mjs'
import { toData } from '../../bnf/data/module.f.mjs'
import {
    eof,
    none,
    notSet,
    option,
    range,
    remove,
    repeat,
    repeat0Plus,
    set,
    unicodeMax,
    unicodeRange,
} from '../../bnf/module.f.mjs'
import { keywords } from '../../js/keywords/module.f.mjs'
import { isKeywordToken, mergeTrivia } from '../../js/tokenizer/module.f.mjs'
import {
    asterisk, backspace, ht, lf, ff, cr,
    quotationMark, solidus, reverseSolidus,
    hexDigitValue,
    latinSmallLetterB, latinSmallLetterF,
    latinSmallLetterN, latinSmallLetterR, latinSmallLetterT, latinSmallLetterU,
} from '../../text/ascii/module.f.mjs'
import { codePointListToString, stringToCodePointList } from '../../text/utf16/module.f.mjs'
import { mapUnwrap } from '../../types/nullable/module.f.mjs'
import { concat, empty, filter, flat, flatMap, fold, map, stateScan, toArray } from '../../types/list/module.f.mjs'
import { stringifyAsTree } from '../serializer/module.f.mjs'
import { sort } from '../../types/object/module.f.mjs'

// Builds the single-token grammar that jsGrammar's whole-file `tokens` rule repeats.
/**
 * The whitespace characters the grammar's `ws` rule matches.
 *
 * The grammar's rule and every downstream check of a trivia tag are built from
 * this one string: the descent parser emits a range-variant branch's tag as the
 * matched character itself, so the characters the rule accepts *are* the tags it
 * produces. Spelling them a second time is what let the two drift apart.
 *
 * @type {string}
 */
const wsChars = ' \t'

/**
 * The newline characters the grammar's `newLine` rule matches, the single source
 * for that rule and its tags exactly as {@link wsChars} is.
 *
 * @type {string}
 */
const nlChars = '\n\r'

/** @type {ReadonlySet<string>} */
const wsTags = new Set(wsChars)

/** @type {ReadonlySet<string>} */
const nlTags = new Set(nlChars)

/**
 * The operator vocabulary: each key is the tag the descent parser emits for that
 * branch, and each value the characters it matches.
 *
 * At module scope because it captures nothing from `buildToken`, and because
 * `operatorTags` derives the tag set from these keys rather than re-listing them.
 */
const operator = {
    '.': '.',
    '=>': '=>',
    '===': '===',
    '==': '==',
    '=': '=',
    '!==': '!==',
    '!=': '!=',
    '!': '!',
    '>>>=': '>>>=',
    '>>>': '>>>',
    '>>=': '>>=',
    '>>': '>>',
    '>=': '>=',
    '>': '>',
    '<<=': '<<=',
    '<<': '<<',
    '<=': '<=',
    '<': '<',
    '+=': '+=',
    '++': '++',
    '+': '+',
    '-=': '-=',
    '--': '--',
    '-': '-',
    '**=': '**=',
    '**': '**',
    '*=': '*=',
    '*': '*',
    '/=': '/=',
    '/': '/',
    '%=': '%=',
    '%': '%',
    '&&=': '&&=',
    '&&': '&&',
    '&=': '&=',
    '&': '&',
    '||=': '||=',
    '||': '||',
    '|=': '|=',
    '|': '|',
    '^=': '^=',
    '^': '^',
    '~': '~',
    '??=': '??=',
    '??': '??',
    '?.': '?.',
    '?': '?',
    '[': '[',
    ']': ']',
    '{': '{',
    '}': '}',
    '(': '(',
    ')': ')',
    ',': ',',
    ':': ':'
}

/** @type {() => Rule} */
const buildToken = () => {

    const onenine = range('19')

    /** @type {Rule} */
    const digit = range('09')

    const string = [
        '"',
        repeat0Plus({
            ...remove(range(` ${unicodeMax}`), set('"\\')),
            escape: [
                '\\',
                {
                    ...set('"\\bfnrt'),
                    solidus: '/',
                    u: [
                        'u',
                        ...repeat(4)({
                            digit,
                            AF: range('AF'),
                            af: range('af'),
                        })
                    ],
                }
            ],
        }),
        '"'
    ]

    const digits0 = repeat0Plus(digit)

    const digits = [digit, digits0]

    const ws = set(wsChars)

    const newLine = set(nlChars)

    const idStart = {
        smallLetter: range('az'),
        bigLetter: range('AZ'),
        lowLine: '_',
        dollarSign: '$'
    }

    const idChar = {
        ...idStart,
        digit
    }

    // '.' and 'e'/'E' always succeed once seen, tagging missing digits as `numError`,
    // so a malformed fraction/exponent (e.g. `0.`, `0e`) fails the whole number instead
    // of silently ending it early. The sign is matched via string-literal branches
    // (not `set('+-')`) because a range-variant branch's tag is the matched character
    // itself, which would collide with the '+'/'-' operator tags in filterFunc.
    const fracPart = { withDot: ['.', { valid: digits, numError: none }], noDot: none }
    const expPart = { withExp: [set('Ee'), option({ plus: '+', minus: '-' }), { valid: digits, numError: none }], noExp: none }

    // ECMAScript disallows a NumericLiteral immediately followed by an IdentifierStart
    // or DecimalDigit (e.g. `00`, `123abc`). Consume that character into the number and
    // tag it `numError` instead of leaving it to silently start a new token. idChar is
    // wrapped in a sequence so this branch's own `numError` tag survives — a variant
    // referenced directly as another variant's branch loses the outer tag to whichever
    // of its own branches matches.
    const number = [
        {
            0: '0',
            onenine: [onenine, digits0],
        },
        option({
            bigint: 'n',
            frac: [fracPart, expPart]
        }),
        { numError: [idChar], ok: none }
    ]

    const id = [idStart, repeat0Plus(idChar)]

    // Recursive rule: tries end (*/) first at every position so **/  → content(*) + terminator(*/).
    // Falls back to the empty `unterminated` alternative at EOF instead of failing, so `comment`
    // always succeeds and the descent parser never backtracks into matching '/' and '*' as
    // separate operators. Callers detect an unterminated comment by checking for this tag.
    /** @type {() => DataRule} */
    const multilineContent = () => {
        /** @type {Rule} */
        const char = { na: notSet('*'), a: '*' }
        /** @type {Rule} */
        const end = ['*', '/']
        /** @type {Rule} */
        const more = [char, multilineContent]
        return { end, more, unterminated: none }
    }

    const comment = ['/', {
            // TODO: investigate why `not(commentEnd)` instead of `remove(unicodeRange, newLine)` fail tests.
            oneline: ['/', repeat0Plus(remove(unicodeRange, newLine)), option(newLine)],
            multiline: ['*', multilineContent]
        }
    ]

    const token = {
        number,
        string,
        id,
        comment,
        operator,
        ws,
        newLine,
        eof
    }

    return token
}

// The whole file's token stream as one right-recursive grammar rule. Safe at any input
// length: descentParser matches on an explicit frame stack, not the JS call stack
// (see fjs/bnf/descent/module.f.mjs).
/** @type {() => Rule} */
export const jsGrammar = () => repeat0Plus(buildToken())

/**
 * The whole-file matcher together with the name of the rule to start it at.
 *
 * `toData` generates rule names, so the entry name belongs to the conversion
 * rather than to the grammar's spelling and is read back from it here. Building
 * both from one conversion also keeps the grammar built once per matcher.
 *
 * @type {<T>() => readonly [DescentMatch<T>, string]}
 */
export const jsMatcher = () => {
    const [ruleSet, entry] = toData(jsGrammar())
    return [descentParserRuleSet(ruleSet), entry]
}

const stringify = stringifyAsTree(sort)

/** @type {(cp: CodePoint) => CodePointMeta<unknown>} */
const mapCodePoint = cp => [cp, undefined]

/** @type {(m: DescentMatch<unknown>, name: string, cp: readonly CodePoint[]) => DescentMatchResult<unknown>} */
export const descentParserCpOnly = (m, name, cp) => {
    const cpm = toArray(map(mapCodePoint)(cp))
    return m(name, cpm)
}

// Advances path/line/column by one code point, mirroring fjs/js/tokenizer's tokenizeWithPositionOp.
/** @type {(cp: number) => (metadata: TokenMetadata) => TokenMetadata} */
const advanceMetadata = cp => metadata => cp === lf
    ? { path: metadata.path, line: metadata.line + 1, column: 1 }
    : { path: metadata.path, line: metadata.line, column: metadata.column + 1 }

// Pairs each code point with the metadata of its position *before* it's consumed.
/** @type {StateScan<number, TokenMetadata, readonly [CodePointMeta<TokenMetadata>]>} */
const metadataScan = (cp, metadata) => [[[cp, metadata]], advanceMetadata(cp)(metadata)]

/** @type {(path: string) => (cp: readonly number[]) => readonly CodePointMeta<TokenMetadata>[]} */
const codePointsWithMetadata = path => cp => toArray(flat(stateScan(metadataScan)({ path, line: 1, column: 1 })(cp)))

// tag, the metadata of the token's first code point, and its code points.
/** @typedef {[string, TokenMetadata, readonly number[]]} _Token */

/** @typedef {string | CodePointMeta<TokenMetadata>} _FlatToken */

/** @typedef {[string, TokenMetadata | null, List<number>]} _TokenScanState */

/**
 * The grammar tag of a trivia code point, as the kind `mergeTrivia` speaks in;
 * `null` for every other tag.
 *
 * @type {(tag: string) => Nullable<TriviaKind>}
 */
const triviaKind = tag =>
    nlTags.has(tag) ? 'nl' :
    wsTags.has(tag) ? 'ws' :
    null

/** @type {StateScan<_FlatToken, _TokenScanState, List<_Token>>} */
const scanFunc = (input, state) => {
    const [stateTag, stateMetadata, stateCodePoints] = state
    if (typeof input === 'string') {
        // A trivia run continues: `mergeTrivia` decides the run's kind, and
        // the pending token only has to be restarted under the incoming tag
        // when that kind is not the one it already has (ws followed by nl).
        const inputKind = triviaKind(input)
        const stateKind = triviaKind(stateTag)
        if (inputKind !== null && stateKind !== null) {
            return [null, mergeTrivia(stateKind, inputKind) === stateKind ? state : [input, null, []]]
        }
        /** @type {_TokenScanState} */
        const newState = [input, null, []]
        if (stateTag === '') {
            return [null, newState]
        }
        /** @type {_Token} */
        const tk = [stateTag, /** @type {TokenMetadata} */ (stateMetadata), toArray(stateCodePoints)]
        return [[tk], newState]
    }
    const [cp, codePointMetadata] = input
    const startMetadata = stateMetadata === null ? codePointMetadata : stateMetadata
    return [null, [stateTag, startMetadata, concat(stateCodePoints)([cp])]]
}

/**
 * All operator tag strings the grammar's `operator` rule produces, derived from
 * the rule itself: the descent parser emits a variant branch's key as its tag,
 * so the keys of {@link operator} *are* the tag set.
 *
 * `'/'` is a member because division is an operator; it does not also swallow
 * the slashes of a comment, since `oneline` consumes the whole rest of the line
 * with `repeat0Plus` and the comment rule matches before the tag reaches here.
 *
 * @type {ReadonlySet<string>}
 */
const operatorTags = new Set(Object.keys(operator))

/** @type {(tk: _FlatToken) => boolean} */
const filterFunc = tk => {
    if (tk instanceof Array)
        return true
    switch (tk) {
        case 'number':
        case 'string':
        case 'id':
        case 'comment':
            return true
        default:
            // Trivia tags go through `triviaKind` rather than a third copy of
            // the characters, so they cannot drift from the grammar's rules.
            return triviaKind(tk) !== null || operatorTags.has(tk)
    }
}

/**
 * A `\uXXXX` escape reaches the `unicode` state only after the grammar has
 * accepted its four hex digits, so a non-hex code point here is a tokenizer
 * bug rather than bad input — assert instead of decoding it to a garbage
 * value, which is what the hand-rolled ternary chain used to do.
 */
const unwrapHexDigitValue = mapUnwrap(hexDigitValue)

/** @typedef {
 *   | { readonly kind: 'normal' }
 *   | { readonly kind: 'escape' }
 *   | { readonly kind: 'unicode', readonly acc: number, readonly count: number }
 * } _StringDecodeState */

/** @type {StateScan<number, _StringDecodeState, List<number>>} */
const stringDecodeScan = (cp, state) => {
    switch (state.kind) {
        case 'escape': {
            // The grammar's own `escape` rule (`buildToken`'s `string`) only ever
            // accepts `"`, `\`, `/`, `b`, `f`, `n`, `r`, `t`, or `u` right after a
            // backslash — any other character fails to parse before a token
            // reaches this scan at all, so narrowing to those nine is provable,
            // not merely assumed.
            assert(
                cp === quotationMark || cp === reverseSolidus || cp === solidus ||
                cp === latinSmallLetterB || cp === latinSmallLetterF || cp === latinSmallLetterN ||
                cp === latinSmallLetterR || cp === latinSmallLetterT || cp === latinSmallLetterU,
                cp)
            switch (cp) {
                case quotationMark:  return [[quotationMark],  { kind: 'normal' }]  // \" → "
                case reverseSolidus: return [[reverseSolidus], { kind: 'normal' }]  // \\ → \
                case solidus:        return [[solidus],        { kind: 'normal' }]  // \/ → /
                case latinSmallLetterB: return [[backspace], { kind: 'normal' }]    // \b → backspace (BS)
                case latinSmallLetterF: return [[ff],        { kind: 'normal' }]    // \f → form feed (FF)
                case latinSmallLetterN: return [[lf],        { kind: 'normal' }]    // \n → line feed (LF)
                case latinSmallLetterR: return [[cr],        { kind: 'normal' }]    // \r → carriage return (CR)
                case latinSmallLetterT: return [[ht],        { kind: 'normal' }]    // \t → horizontal tab (HT)
                // `\u` is the only case the assertion above leaves. It is a
                // `default` rather than a `case latinSmallLetterU` because the
                // ASCII constants are plain `number`s, so the switch can never
                // be exhaustive to TypeScript and the clause would fall through
                // into `unicode` below.
                default: return [null, { kind: 'unicode', acc: 0, count: 0 }]  // \u → start 4 hex digits
            }
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

/** @type {(tk: _Token) => JsToken} */
const toJsToken = tk => {
    const [tag, , codePoints] = tk
    switch (tag) {
        case '\n':
        case '\r':
            return { kind: 'nl' }
        case ' ':
        case '\t':
            return { kind: 'ws' }
        case 'string':
            return { kind: 'string', value: decodeJsonString(codePoints) }
        case 'id': {
            const value = codePointListToString(codePoints)
            if (keywordSet.has(value)) return /** @type {JsToken} */ ({ kind: value })
            return { kind: 'id', value }
        }
        case 'number': {
            const value = codePointListToString(codePoints)
            if (value.endsWith('n')) return { kind: 'bigint', value: BigInt(value.slice(0, -1)) }
            return { kind: 'number', value }
        }
        case 'comment':
            if (codePoints[1] === asterisk) // block comment /*...*/
                return { kind: '/*', value: codePointListToString(codePoints.slice(2, -2)) }
            return { kind: '//', value: codePointListToString(codePoints.slice(2)) }
        default:
            return /** @type {JsToken} */ ({ kind: tag })
    }
}

/** @type {(tk: _Token) => List<JsToken>} */
const toJsTokens = tk => {
    const token = toJsToken(tk)
    if (token.kind === '/*') {
        const hasNl = token.value.includes('\n') || token.value.includes('\r')
        if (hasNl) return [token, { kind: 'nl' }]
    }
    return [token]
}

// Same as toJsTokens, but pairs each emitted token with tk's start metadata instead of
// discarding it — used by tokenize (the metadata-aware entry point), not tokenizeString.
/** @type {(tk: _Token) => List<JsTokenWithMetadata>} */
const toJsTokenWithMetadata = tk => {
    const [, metadata] = tk
    const token = toJsToken(tk)
    if (token.kind === '/*') {
        const hasNl = token.value.includes('\n') || token.value.includes('\r')
        if (hasNl) return [{ token, metadata }, { token: { kind: 'nl' }, metadata }]
    }
    return [{ token, metadata }]
}

/** @type {(value: Ast<CodePointMeta<TokenMetadata>>|CodePointMeta<TokenMetadata>) => List<_FlatToken>} */
const getTokensFromAstRuleOrCodePoint = value => {
    if (value instanceof Array)
        return [value]

    return getTokensFromAstRule(value)
}

/** @type {(seq: AstSequence<CodePointMeta<TokenMetadata>>) => List<_FlatToken>} */
const getTokensFromAstSequence = seq => {
    return flatMap(getTokensFromAstRuleOrCodePoint)(seq)
}

/** @type {(tag: AstTag) => _FlatToken} */
const tagToToken = tag => {
    switch (typeof tag) {
        case 'string': return tag
        case 'undefined': return 'undefined'
        default: return 'true'
    }
}

/** @type {(ast: Ast<CodePointMeta<TokenMetadata>>) => List<_FlatToken>} */
const getTokensFromAstRule = ast => {
    const token = tagToToken(ast.tag)
    if (ast.sequence.length === 0)
        return [token]

    return { first: token, tail: getTokensFromAstSequence(ast.sequence) }
}

/** @type {(s: string) => string} */
export const tokenizeString = s => {
    const cp = toArray(stringToCodePointList(s))
    if (cp.length === 0) {
        return stringify([{ kind: 'eof' }])
    }
    const [m, entry] = jsMatcher()
    const cpm = codePointsWithMetadata('')(cp)
    const { ast, success: ok, idx: len } = m(entry, cpm)
    if (!ok || len !== cp.length)
        return 'error'

    const flatTokens = toArray(getTokensFromAstRule(ast))
    // multilineContent tags an unterminated block comment as 'unterminated', and number
    // tags a malformed fraction/exponent or a disallowed trailing char as 'numError',
    // rather than failing outright — detect them here instead.
    if (flatTokens.includes('unterminated') || flatTokens.includes('numError')) return 'error'
    const filterTokens = concat(filter(filterFunc)(flatTokens))([''])
    const tokens = flat(stateScan(scanFunc)(['', null, []])(filterTokens))
    const jsTokens = concat(flatMap(toJsTokens)(tokens))([{ kind: 'eof' }])
    const result = toArray(jsTokens)
    return stringify(result)
}

// Finds `tag` in flatTokens and returns the metadata of the next code point after it.
// numError/unterminated tags are followed by the poisoning char / EOF-hitting position
// in the flattened AST walk order, so this pinpoints roughly where tokenization failed.
//
// The single call site only passes a `tag` it already confirmed via
// `flatTokens.includes(tag)`, so `indexOf` here is never -1.
/** @type {(tag: string, flatTokens: readonly _FlatToken[], fallback: TokenMetadata) => TokenMetadata} */
const metadataAfterTag = (tag, flatTokens, fallback) => {
    const idx = flatTokens.indexOf(tag)
    const found = flatTokens.slice(idx + 1).find((/** @type {_FlatToken} */ t) => t instanceof Array)
    return found === undefined ? fallback : found[1]
}

/** @type {(input: List<number>) => (path: string) => List<JsTokenWithMetadata>} */
export const tokenizeJs = input => path => {
    const cp = toArray(input)
    /** @type {TokenMetadata} */
    const initial = { path, line: 1, column: 1 }
    if (cp.length === 0) return [{ token: { kind: 'eof' }, metadata: initial }]

    const [m, entry] = jsMatcher()
    const cpm = codePointsWithMetadata(path)(cp)
    const { ast, success: ok, idx: len } = m(entry, cpm)
    const finalMetadata = fold(advanceMetadata)(initial)(cp)

    if (!ok || len !== cp.length) {
        // `len` is always `< cpm.length` (`=== cp.length`) here: `ok` false only
        // ever happens with `len === 0` (nothing matched at position 0), and a
        // `len !== cp.length` failure with `ok` true is by definition a partial
        // match (`len < cp.length`) — `repeat0Plus` never fails after
        // successfully consuming the whole input, so there is no way to reach
        // this branch with `len === cp.length`.
        return [{ token: { kind: 'error', message: 'invalid token' }, metadata: cpm[len][1] }]
    }

    const flatTokens = toArray(getTokensFromAstRule(ast))
    const structuralError = flatTokens.includes('unterminated') ? 'unterminated'
        : flatTokens.includes('numError') ? 'numError'
        : null
    if (structuralError !== null) {
        const errorMetadata = metadataAfterTag(structuralError, flatTokens, finalMetadata)
        return [{ token: { kind: 'error', message: 'invalid token' }, metadata: errorMetadata }]
    }

    const filterTokens = concat(filter(filterFunc)(flatTokens))([''])
    const tokens = flat(stateScan(scanFunc)(['', null, []])(filterTokens))
    const withMetadata = concat(flatMap(toJsTokenWithMetadata)(tokens))
    return withMetadata([{ token: { kind: 'eof' }, metadata: finalMetadata }])
}

/** @typedef {{ readonly kind: 'def' | '-' }} _DjsScanState */

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
// fjs/djs/tokenizer's minus-state exactly.
//
// No `case '-'` here: the underlying `js/tokenizer` always merges two adjacent
// `-` characters into a single `'--'` token (the decrement operator), so this
// state — entered only after a single, unmerged `-` — can never itself see
// another `'-'`-kind input. Such an input falls through to `default`, which
// handles it exactly like any other non-number/bigint/eof token.
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

export const proof = {
    // `tagToToken`'s `true` arm fires only for an `AstTag` of literal `true`.
    // `bnf/data`'s `emptyTagOf` is the only source of that value, and
    // `bnf/descent/module.f.mjs` reads it in exactly one place (its variant
    // arm), always wrapped in `mrFail` — a failure. A failed variant only
    // propagates as the overall `result` when nothing in it matches, so it
    // never survives into a successful sequence/AST; a `true` tag therefore
    // can never appear on a successful `descentParser` match for any
    // grammar, `jsGrammar` included, so `tokenizeJs` can't reach this arm.
    // Call it directly to cover that branch.
    tagToTokenTrueTag: () => {
        assertEq(tagToToken(true), 'true')
    },
}
