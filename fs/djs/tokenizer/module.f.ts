/**
 * Experimental DJS parser implementation.
 *
 * @module
 */
import {
    descentParser,
    type AstRuleMeta,
    type AstSequenceMeta,
    type AstTag,
    type CodePointMeta,
    type DescentMatch,
    type DescentMatchResult
} from "../../bnf/descent/module.f.ts"
import {
    eof,
    max,
    none,
    notSet,
    option,
    range,
    remove,
    repeat,
    repeat0Plus,
    set,
    unicodeRange,
    type DataRule,
    type Rule
} from "../../bnf/module.f.ts"
import {
    isKeywordToken,
    type BigIntToken,
    type CommentToken,
    type EofToken,
    type ErrorToken,
    type IdToken,
    type JsToken,
    type JsTokenWithMetadata,
    type NewLineToken,
    type NumberToken,
    type StringToken,
    type TokenMetadata,
    type WhitespaceToken,
} from "../../js/tokenizer/module.f.ts"
import { multiply } from "../../types/bigfloat/module.f.ts"
import {
    asterisk, backspace, ht, lf, ff, cr,
    quotationMark, solidus, reverseSolidus,
    digitRange, digit0,
    latinCapitalLetterA,
    latinSmallLetterA, latinSmallLetterB, latinSmallLetterF,
    latinSmallLetterN, latinSmallLetterR, latinSmallLetterT, latinSmallLetterU,
    range as asciiRange,
} from "../../text/ascii/module.f.ts"
import { type CodePoint, codePointListToString, stringToCodePointList } from "../../text/utf16/module.f.ts"
import type { StateScan } from "../../types/function/operator/module.f.ts"
import { contains } from "../../types/range/module.f.ts"
import { concat, empty, filter, flat, flatMap, fold, map, stateScan, toArray, type List } from "../../types/list/module.f.ts"
import { stringifyAsTree } from "../serializer/module.f.ts"
import { sort } from "../../types/object/module.f.ts"
import type { Unknown } from "../module.f.ts"

// Builds the single-token grammar (everything jsGrammar's whole-file `tokens` rule repeats).
// Factored out so tokenizeString/tokenizeJs can match one token at a time from a plain JS
// loop instead of via descentParser's whole-file recursion — see todo/stack-recursive-tokenization.md.
const buildToken = (): Rule => {

    const onenine = range('19')

    const digit: Rule = range('09')

    const string = [
        '"',
        repeat0Plus({
            ...remove(range(` ${max}`), set('"\\')),
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

    const ws = set(' \t')

    const newLine = set('\n\r')

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

    // Recursive rule: tries end (*/) first at every position so **/  → content(*) + terminator(*/).
    // Falls back to the empty `unterminated` alternative at EOF instead of failing, so `comment`
    // always succeeds and the descent parser never backtracks into matching '/' and '*' as
    // separate operators. Callers detect an unterminated comment by checking for this tag.
    const multilineContent = (): DataRule => {
        const char: Rule = { na: notSet('*'), a: '*' }
        const end: Rule = ['*', '/']
        const more: Rule = [char, multilineContent]
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

// The whole file's token stream as one right-recursive grammar rule: descentParser
// recurses once per matched token, so matching this directly against realistic-size
// input can throw "Maximum call stack size exceeded" (see
// todo/stack-recursive-tokenization.md). Kept for grammar-level tests against small
// inputs; tokenizeString/tokenizeJs match `buildToken()` in a loop instead.
export const jsGrammar = (): Rule => repeat0Plus(buildToken())

const stringify = stringifyAsTree(sort)

const mapCodePoint = (cp: CodePoint): CodePointMeta<unknown> => [cp, undefined]

export const descentParserCpOnly = (m: DescentMatch<unknown>, name: string, cp: readonly CodePoint[]): DescentMatchResult<unknown> => {
    const cpm = toArray(map(mapCodePoint)(cp))
    return m(name, cpm)
}

// Advances path/line/column by one code point, mirroring fs/js/tokenizer's tokenizeWithPositionOp.
const advanceMetadata
    : (cp: number) => (metadata: TokenMetadata) => TokenMetadata
    = cp => metadata => cp === lf
        ? { path: metadata.path, line: metadata.line + 1, column: 1 }
        : { path: metadata.path, line: metadata.line, column: metadata.column + 1 }

// Pairs each code point with the metadata of its position *before* it's consumed.
const metadataScan
    : StateScan<number, TokenMetadata, readonly [CodePointMeta<TokenMetadata>]>
    = (cp, metadata) => [[[cp, metadata]], advanceMetadata(cp)(metadata)]

const codePointsWithMetadata
    : (path: string) => (cp: readonly number[]) => readonly CodePointMeta<TokenMetadata>[]
    = path => cp => toArray(flat(stateScan(metadataScan)({ path, line: 1, column: 1 })(cp)))

// tag, the metadata of the token's first code point, and its code points.
type Token = [string, TokenMetadata, readonly number[]]

type FlatToken = string | CodePointMeta<TokenMetadata>

type TokenScanState = [string, TokenMetadata | null, List<number>]

const isNlTag = (tag: string): boolean => tag === '\n' || tag === '\r'
const isWsTag = (tag: string): boolean => tag === ' ' || tag === '\t'

const scanFunc
    : StateScan<FlatToken, TokenScanState, List<Token>>
    = (input, state) => {
        const [stateTag, stateMetadata, stateCodePoints] = state
        if (typeof input === 'string') {
            if (isNlTag(input) && isNlTag(stateTag)) return [null, state]
            if (isWsTag(input) && isWsTag(stateTag)) return [null, state]
            if (isNlTag(input) && isWsTag(stateTag)) return [null, [input, null, []]]
            if (isWsTag(input) && isNlTag(stateTag)) return [null, state]
            const newState: TokenScanState = [input, null, []]
            if (stateTag === '') {
                return [null, newState]
            }
            const tk: Token = [stateTag, stateMetadata!, toArray(stateCodePoints)]
            return [[tk], newState]
        }
        const [cp, codePointMetadata] = input
        const startMetadata = stateMetadata === null ? codePointMetadata : stateMetadata
        return [null, [stateTag, startMetadata, concat(stateCodePoints)([cp])]]
    }

// All operator tag strings produced by the grammar's operator rule
const operatorTags = new Set<string>([
    '.', '=>', '===', '==', '=', '!==', '!=', '!',
    '>>>=', '>>>', '>>=', '>>', '>=', '>',
    '<<=', '<<', '<=', '<',
    '+=', '++', '+', '-=', '--', '-',
    '**=', '**', '*=', '*', '/=', '/', '%=', '%', // TODO: '/' here causes multi-char line comments (e.g. //ab\n) to fall through as two '/' operator tokens because the oneline rule only consumes one non-newline character (option vs repeat0Plus). Fix the comment rule to use repeat0Plus, or make filterFunc distinguish operator-branch '/' from slash characters inside comments.
    '&&=', '&&', '&=', '&', '||=', '||', '|=', '|',
    '^=', '^', '~', '??=', '??', '?.', '?',
    '[', ']', '{', '}', '(', ')', ',', ':'
])

const filterFunc
    : (tk: FlatToken) => boolean
    = tk => {
        if (tk instanceof Array)
            return true
        switch(tk) {
            case 'number':
            case 'string':
            case 'id':
            case 'comment':
            case '\n':
            case '\r':
            case ' ':
            case '\t':
                return true
            default:
                return operatorTags.has(tk)
        }
    }

const rangeCapitalAF = asciiRange('AF')

type StringDecodeState =
    | { readonly kind: 'normal' }
    | { readonly kind: 'escape' }
    | { readonly kind: 'unicode', readonly acc: number, readonly count: number }

const stringDecodeScan
    : StateScan<number, StringDecodeState, List<number>>
    = (cp, state) => {
        switch (state.kind) {
            case 'escape':
                switch (cp) {
                    case quotationMark:  return [[quotationMark],  { kind: 'normal' }]  // \" → "
                    case reverseSolidus: return [[reverseSolidus], { kind: 'normal' }]  // \\ → \
                    case solidus:        return [[solidus],        { kind: 'normal' }]  // \/ → /
                    case latinSmallLetterB: return [[backspace], { kind: 'normal' }]    // \b → backspace (BS)
                    case latinSmallLetterF: return [[ff],        { kind: 'normal' }]    // \f → form feed (FF)
                    case latinSmallLetterN: return [[lf],        { kind: 'normal' }]    // \n → line feed (LF)
                    case latinSmallLetterR: return [[cr],        { kind: 'normal' }]    // \r → carriage return (CR)
                    case latinSmallLetterT: return [[ht],        { kind: 'normal' }]    // \t → horizontal tab (HT)
                    case latinSmallLetterU: return [null, { kind: 'unicode', acc: 0, count: 0 }]  // \u → start 4 hex digits
                    default:  return [[cp], { kind: 'normal' }]
                }
            case 'unicode': {
                // convert hex digit char to its numeric value: '0'-'9', 'A'-'F', 'a'-'f'
                const digit = contains(digitRange)(cp) ? cp - digit0
                    : contains(rangeCapitalAF)(cp) ? cp - (latinCapitalLetterA - 10)
                    : cp - (latinSmallLetterA - 10)
                const acc = (state.acc << 4) | digit
                return state.count === 3 ? [[acc], { kind: 'normal' }] : [null, { kind: 'unicode', acc, count: state.count + 1 }]
            }
            default:
                return cp === reverseSolidus ? [null, { kind: 'escape' }] : [[cp], { kind: 'normal' }]
        }
    }

const decodeJsonString
    : (codePoints: readonly number[]) => string
    = codePoints => codePointListToString(flat(stateScan(stringDecodeScan)({ kind: 'normal' })(codePoints.slice(1, -1))))

// value is grammar-validated: (0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)? — no need to re-check its shape here.
const decodeNumber
    : (value: string) => readonly [bigint, number]
    = value => {
        // at most one of 'e'/'E' can occur, so whichever indexOf finds it (if any) is the exponent marker
        const lowerEIndex = value.indexOf('e')
        const eIndex = lowerEIndex < 0 ? value.indexOf('E') : lowerEIndex
        const mantissaText = eIndex < 0 ? value : value.slice(0, eIndex)
        const expText = eIndex < 0 ? '' : value.slice(eIndex + 1)
        const dotIndex = mantissaText.indexOf('.')
        const intDigits = dotIndex < 0 ? mantissaText : mantissaText.slice(0, dotIndex)
        const fracDigits = dotIndex < 0 ? '' : mantissaText.slice(dotIndex + 1)
        const mantissa = BigInt(intDigits + fracDigits)
        const exp = (expText === '' ? 0 : Number(expText)) - fracDigits.length
        return [mantissa, exp]
    }

const keywords = new Set<string>([
    'true', 'false', 'null', 'undefined',
    'arguments', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue',
    'debugger', 'default', 'delete', 'do', 'else', 'enum', 'eval', 'export',
    'extends', 'finally', 'for', 'function', 'if', 'implements', 'import', 'in',
    'instanceof', 'interface', 'let', 'new', 'package', 'private', 'protected',
    'public', 'return', 'static', 'super', 'switch', 'this', 'throw', 'try',
    'typeof', 'var', 'void', 'while', 'with', 'yield',
])

const toJsToken
    : (tk: Token) => JsToken
    = tk => {
        const [tag, , codePoints] = tk
        switch(tag) {
            case '\n':
            case '\r':
                return {kind: 'nl'}
            case ' ':
            case '\t':
                return {kind: 'ws'}
            case 'string':
                return {kind: 'string', value: decodeJsonString(codePoints)}
            case 'id': {
                const value = codePointListToString(codePoints)
                if (keywords.has(value)) return {kind: value} as JsToken
                return {kind: 'id', value}
            }
            case 'number': {
                const value = codePointListToString(codePoints)
                if (value.endsWith('n')) return {kind: 'bigint', value: BigInt(value.slice(0, -1))}
                return {kind: 'number', value, bf: decodeNumber(value)}
            }
            case 'comment':
                if (codePoints[1] === asterisk) // block comment /*...*/
                    return {kind: '/*', value: codePointListToString(codePoints.slice(2, -2))}
                return {kind: '//', value: codePointListToString(codePoints.slice(2))}
            default:
                return {kind: tag} as JsToken
        }
    }

const toJsTokens
    : (tk: Token) => List<JsToken>
    = tk => {
        const token = toJsToken(tk)
        if (token.kind === '/*') {
            const hasNl = token.value.includes('\n') || token.value.includes('\r')
            if (hasNl) return [token, { kind: 'nl' }]
        }
        return [token]
    }

// Same as toJsTokens, but pairs each emitted token with tk's start metadata instead of
// discarding it — used by tokenize (the metadata-aware entry point), not tokenizeString.
const toJsTokenWithMetadata
    : (tk: Token) => List<JsTokenWithMetadata>
    = tk => {
        const [, metadata] = tk
        const token = toJsToken(tk)
        if (token.kind === '/*') {
            const hasNl = token.value.includes('\n') || token.value.includes('\r')
            if (hasNl) return [{ token, metadata }, { token: { kind: 'nl' }, metadata }]
        }
        return [{ token, metadata }]
    }

const getTokensFromAstRuleOrCodePoint
    : (value: AstRuleMeta<TokenMetadata>|CodePointMeta<TokenMetadata>) => List<FlatToken>
    = value => {
        if (value instanceof Array)
            return [value]

        return getTokensFromAstRule(value)
    }

const getTokensFromAstSequence
    : (seq: AstSequenceMeta<TokenMetadata>) => List<FlatToken>
    = seq => {
        return flatMap(getTokensFromAstRuleOrCodePoint)(seq)
    }

const tagToToken
    : (tag: AstTag) => FlatToken
    = tag => {
        switch (typeof tag) {
            case 'string': return tag
            case 'undefined': return 'undefined'
            default: return 'true'
        }
    }

const getTokensFromAstRule
    : (ast: AstRuleMeta<TokenMetadata>) => List<FlatToken>
    = ast => {
        const token = tagToToken(ast.tag)
        if (ast.sequence.length === 0)
            return [token]

        return { first: token, tail: getTokensFromAstSequence(ast.sequence)}
    }

// Matches `buildToken()` in a plain JS loop, advancing the code-point offset one token at
// a time. This keeps descentParser's call-stack depth bounded by a single token's length
// instead of the whole file's token count — see todo/stack-recursive-tokenization.md.
// Returns the matched token ASTs in file order and how many code points were consumed;
// `consumed < cpm.length` means the token at that offset failed to match (invalid input).
const tokenizeToAsts
    : (cpm: readonly CodePointMeta<TokenMetadata>[]) => readonly [readonly AstRuleMeta<TokenMetadata>[], number]
    = cpm => {
        const m = descentParser<TokenMetadata>(buildToken())
        const asts: AstRuleMeta<TokenMetadata>[] = []
        let offset = 0
        while (offset < cpm.length) {
            const [ast, ok, len] = m('', cpm.slice(offset))
            if (!ok)
                break
            asts.push(ast)
            offset += len
        }
        return [asts, offset]
    }

export const tokenizeString
    : (s: string) => string
    = s => {
        const cp = toArray(stringToCodePointList(s))
        if (cp.length === 0) {
            return stringify([{kind: 'eof'}] as Unknown)
        }
        const cpm = codePointsWithMetadata('')(cp)
        const [asts, len] = tokenizeToAsts(cpm)
        if (len !== cp.length)
            return 'error'

        const flatTokens = toArray(flatMap(getTokensFromAstRule)(asts))
        // multilineContent tags an unterminated block comment as 'unterminated', and number
        // tags a malformed fraction/exponent or a disallowed trailing char as 'numError',
        // rather than failing outright — detect them here instead.
        if (flatTokens.includes('unterminated') || flatTokens.includes('numError')) return 'error'
        const filterTokens = concat(filter(filterFunc)(flatTokens))([''])
        const tokens = flat(stateScan(scanFunc)(['', null, []])(filterTokens))
        const jsTokens = concat(flatMap(toJsTokens)(tokens))([{kind: 'eof'}])
        const result = toArray(jsTokens)
        return stringify(result as Unknown)
    }

// Finds `tag` in flatTokens and returns the metadata of the next code point after it.
// numError/unterminated tags are followed by the poisoning char / EOF-hitting position
// in the flattened AST walk order, so this pinpoints roughly where tokenization failed.
const metadataAfterTag
    : (tag: string, flatTokens: readonly FlatToken[], fallback: TokenMetadata) => TokenMetadata
    = (tag, flatTokens, fallback) => {
        const idx = flatTokens.indexOf(tag)
        const found = idx < 0 ? undefined : flatTokens.slice(idx + 1).find((t): t is CodePointMeta<TokenMetadata> => t instanceof Array)
        return found === undefined ? fallback : found[1]
    }

export const tokenizeJs
    : (input: List<number>) => (path: string) => List<JsTokenWithMetadata>
    = input => path => {
        const cp = toArray(input)
        const initial: TokenMetadata = { path, line: 1, column: 1 }
        if (cp.length === 0) return [{ token: { kind: 'eof' }, metadata: initial }]

        const cpm = codePointsWithMetadata(path)(cp)
        const [asts, len] = tokenizeToAsts(cpm)
        const finalMetadata = fold(advanceMetadata)(initial)(cp)

        if (len !== cp.length) {
            const errorMetadata = len < cpm.length ? cpm[len][1] : finalMetadata
            return [{ token: { kind: 'error', message: 'invalid token' }, metadata: errorMetadata }]
        }

        const flatTokens = toArray(flatMap(getTokensFromAstRule)(asts))
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

// DJS-level token set: a narrower view of JsToken (only true/false/null/undefined survive
// as bare keywords; every other keyword becomes an id) plus its own punctuator kinds.
export type DjsToken = |
  {readonly kind: 'true' | 'false' | 'null' | 'undefined'} |
  {readonly kind: '{' | '}' | ':' | ',' | '[' | ']' | '.' | '=' } |
  StringToken |
  NumberToken |
  ErrorToken |
  IdToken |
  BigIntToken |
  WhitespaceToken |
  NewLineToken |
  CommentToken |
  EofToken

export type DjsTokenWithMetadata = {readonly token: DjsToken, readonly metadata: TokenMetadata}

type DjsScanState = {readonly kind: 'def' | '-' }

const mapDjsToken
    : (input: JsToken) => List<DjsToken>
    = input => {
        switch(input.kind) {
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

const parseDjsDefaultState
    : (input: JsToken) => readonly [List<DjsToken>, DjsScanState]
    = input => {
        switch(input.kind) {
            case 'eof': return [[{ kind: 'eof' }], { kind: 'def' }]
            case '-': return [empty, { kind: '-' }]
            default: return [mapDjsToken(input), { kind: 'def' }]
        }
    }

// Folds a leading '-' into the following number/bigint token, mirroring the old
// fs/djs/tokenizer's minus-state exactly.
const parseDjsMinusState
    : (input: JsToken) => readonly [List<DjsToken>, DjsScanState]
    = input => {
        switch(input.kind) {
            case 'eof': return [[{ kind: 'error', message: 'invalid token' }, { kind: 'eof' }], { kind: 'def' }]
            case '-': return [[{ kind: 'error', message: 'invalid token' }], { kind: '-' }]
            case 'bigint': return [[{ kind: 'bigint', value: -1n * input.value }], { kind: 'def' }]
            case 'number': return [[{ kind: 'number', bf: multiply(input.bf)(-1n), value: `-${input.value}` }], { kind: 'def' }]
            default: return [{ first: { kind: 'error', message: 'invalid token' }, tail: mapDjsToken(input) }, { kind: 'def' }]
        }
    }

const scanDjsToken
    : StateScan<JsToken, DjsScanState, List<DjsToken>>
    = (input, state) => {
        switch(state.kind) {
            case '-': return parseDjsMinusState(input)
            default: return parseDjsDefaultState(input)
        }
    }

const mapDjsTokenWithMetadata
    : (metadata: TokenMetadata) => (token: DjsToken) => DjsTokenWithMetadata
    = metadata => token => ({ token, metadata })

const scanDjsTokenWithMetadata
    : StateScan<JsTokenWithMetadata, DjsScanState, List<DjsTokenWithMetadata>>
    = (input, state) => {
        const [djsTokens, newState] = scanDjsToken(input.token, state)
        return [map(mapDjsTokenWithMetadata(input.metadata))(djsTokens), newState]
    }

export const tokenize
    : (input: List<number>) => (path: string) => List<DjsTokenWithMetadata>
    = input => path => flat(stateScan(scanDjsTokenWithMetadata)({ kind: 'def' })(tokenizeJs(input)(path)))
