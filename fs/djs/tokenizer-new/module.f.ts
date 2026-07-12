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
    join0Plus,
    max,
    none,
    not,
    notSet,
    oneEncode,
    option,
    range,
    remove,
    repeat,
    repeat0Plus,
    repeat1Plus,
    set,
    unicodeRange,
    type DataRule,
    type Rule
} from "../../bnf/module.f.ts"
import { todo } from "../../asserts/module.f.ts"
import type { JsToken } from "../../js/tokenizer/module.f.ts"
import {
    asterisk, backspace, ht, lf, ff, cr,
    quotationMark, solidus, reverseSolidus,
    digitRange, digit0,
    latinCapitalLetterA,
    latinSmallLetterA, latinSmallLetterB, latinSmallLetterF,
    latinSmallLetterN, latinSmallLetterR, latinSmallLetterT, latinSmallLetterU,
    range as asciiRange,
} from "../../text/ascii/module.f.ts"
import { type CodePoint, stringToCodePointList } from "../../text/utf16/module.f.ts"
import type { StateScan } from "../../types/function/operator/module.f.ts"
import { contains } from "../../types/range/module.f.ts"
import { concat, filter, flat, flatMap, map, stateScan, toArray, type List } from "../../types/list/module.f.ts"
import { stringifyAsTree } from "../serializer/module.f.ts"
import { sort } from "../../types/object/module.f.ts"
import type { Unknown } from "../module.f.ts"

export const parse = (input: string): boolean => {
    const m = descentParser(jsGrammar())
    return todo()
}

export const jsGrammar = (): Rule => {

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
        '<<<<=': '<<<=',
        '<<<': '<<<',
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

    const tokens = repeat0Plus(token)

    return tokens
}

const stringify = stringifyAsTree(sort)

const mapCodePoint = (cp: CodePoint): CodePointMeta<unknown> => [cp, undefined]

export const descentParserCpOnly = (m: DescentMatch<unknown>, name: string, cp: readonly CodePoint[]): DescentMatchResult<unknown> => {
    const cpm = toArray(map(mapCodePoint)(cp))
    return m(name, cpm)
}

type Token = [string, readonly number[]]

type FlatToken = string | number

type TokenScanState = [string, List<number>]

const isNlTag = (tag: string): boolean => tag === '\n' || tag === '\r'
const isWsTag = (tag: string): boolean => tag === ' ' || tag === '\t'

const scanFunc
    : StateScan<FlatToken, TokenScanState, List<Token>>
    = (input, state) => {
        if (typeof input === 'string') {
            if (isNlTag(input) && isNlTag(state[0])) return [null, state]
            if (isWsTag(input) && isWsTag(state[0])) return [null, state]
            if (isNlTag(input) && isWsTag(state[0])) return [null, [input, []]]
            if (isWsTag(input) && isNlTag(state[0])) return [null, state]
            const newState: TokenScanState = [input, []]
            if (state[0] === '') {
                return [null, newState]
            }
            const tk: Token = [state[0], toArray(state[1])]
            return [[tk], newState]
        }
        return [null, [state[0], concat(state[1])([input])]]
    }

// All operator tag strings produced by the grammar's operator rule
const operatorTags = new Set<string>([
    '.', '=>', '===', '==', '=', '!==', '!=', '!',
    '>>>=', '>>>', '>>=', '>>', '>=', '>',
    '<<<=', '<<<', '<<=', '<<', '<=', '<',
    '+=', '++', '+', '-=', '--', '-',
    '**=', '**', '*=', '*', '/=', '/', '%=', '%', // TODO: '/' here causes multi-char line comments (e.g. //ab\n) to fall through as two '/' operator tokens because the oneline rule only consumes one non-newline character (option vs repeat0Plus). Fix the comment rule to use repeat0Plus, or make filterFunc distinguish operator-branch '/' from slash characters inside comments.
    '&&=', '&&', '&=', '&', '||=', '||', '|=', '|',
    '^=', '^', '~', '??=', '??', '?.', '?',
    '[', ']', '{', '}', '(', ')', ',', ':'
])

const filterFunc
    : (tk: FlatToken) => boolean
    = tk => {
        if (typeof tk === 'number')
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
    = codePoints => String.fromCodePoint(...toArray(flat(stateScan(stringDecodeScan)({ kind: 'normal' })(codePoints.slice(1, -1)))))

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
    : (tk: Token) => JsToken | null
    = tk => {
        switch(tk[0]) {
            case '\n':
            case '\r':
                return {kind: 'nl'}
            case ' ':
            case '\t':
                return {kind: 'ws'}
            case 'string':
                return {kind: 'string', value: decodeJsonString(tk[1])}
            case 'id': {
                const value = String.fromCodePoint(...tk[1])
                if (keywords.has(value)) return {kind: value} as JsToken
                return {kind: 'id', value}
            }
            case 'number': {
                const value = String.fromCodePoint(...tk[1])
                if (value.endsWith('n')) return {kind: 'bigint', value: BigInt(value.slice(0, -1))}
                return {kind: 'number', value, bf: decodeNumber(value)}
            }
            case 'comment':
                if (tk[1][1] === asterisk) // block comment /*...*/
                    return {kind: '/*', value: String.fromCodePoint(...tk[1].slice(2, -2))}
                return {kind: '//', value: String.fromCodePoint(...tk[1].slice(2))}
            default:
                return {kind: tk[0]} as JsToken
        }
    }

const toJsTokens
    : (tk: Token) => List<JsToken | null>
    = tk => {
        const token = toJsToken(tk)
        if (token !== null && token.kind === '/*') {
            const hasNl = token.value.includes('\n') || token.value.includes('\r')
            if (hasNl) return [token, { kind: 'nl' }]
        }
        return [token]
    }

const getTokensFromAstRuleOrCodePoint
    : (value: AstRuleMeta<unknown>|CodePointMeta<unknown>) => List<FlatToken>
    = value => {
        if (value instanceof Array)
            return [value[0]]

        return getTokensFromAstRule(value)
    }

const getTokensFromAstSequence
    : (seq: AstSequenceMeta<unknown>) => List<FlatToken>
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
    : (ast: AstRuleMeta<unknown>) => List<FlatToken>
    = ast => {
        const token = tagToToken(ast.tag)
        if (ast.sequence.length === 0)
            return [token]

        return { first: token, tail: getTokensFromAstSequence(ast.sequence)}
    }

export const tokenizeString
    : (s: string) => string
    = s => {
        const m = descentParser(jsGrammar())
        const cp = toArray(stringToCodePointList(s))
        const [ast, ok, len] = descentParserCpOnly(m, '', cp)
        if (cp.length === 0) {
            return stringify([{kind: 'eof'}] as Unknown)
        }
        if (!ok)
            return 'error'
        if (cp.length > 0 && len !== cp.length)
            return 'error'

        const flatTokens = toArray(getTokensFromAstRule(ast))
        // multilineContent tags an unterminated block comment as 'unterminated', and number
        // tags a malformed fraction/exponent or a disallowed trailing char as 'numError',
        // rather than failing outright — detect them here instead.
        if (flatTokens.includes('unterminated') || flatTokens.includes('numError')) return 'error'
        const filterTokens = concat(filter(filterFunc)(flatTokens))([''])
        const tokens = flat(stateScan(scanFunc)(['', []])(filterTokens))
        const jsTokens = concat(flatMap(toJsTokens)(tokens))([{kind: 'eof'}])
        const result = toArray(filter(v => v !== null)(jsTokens))
        return stringify(result as Unknown)
    }
