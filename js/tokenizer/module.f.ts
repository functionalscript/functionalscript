import * as operator from '../../types/function/operator/module.f.ts'
import * as range_map from '../../types/range_map/module.f.ts'
const { merge, fromRange, get } = range_map
import * as list from '../../types/list/module.f.ts'
import * as map from '../../types/ordered_map/module.f.ts'
const { at } = map
import * as _range from '../../types/range/module.f.ts'
const { one } = _range
const { empty, stateScan, flat, toArray, reduce: listReduce, scan } = list
import type * as bigfloatT from '../../types/bigfloat/module.f.ts'
const { fromCharCode } = String
import * as ascii from '../../text/ascii/module.f.ts'
import { contains } from '../../types/range/module.f.ts'
const { range } = ascii
const {
    //
    backspace,
    ht,
    lf,
    ff,
    cr,
    //
    exclamationMark,
    percentSign,
    ampersand,
    asterisk,
    lessThanSign,
    equalsSign,
    greaterThanSign,
    questionMark,
    circumflexAccent,
    verticalLine,
    tilde,
    //
    space,
    quotationMark,
    leftParenthesis,
    rightParenthesis,
    plusSign,
    comma,
    hyphenMinus,
    fullStop,
    solidus,
    //
    digitRange,
    digit0,
    colon,
    //
    latinCapitalLetterRange,
    latinCapitalLetterA,
    latinCapitalLetterE,
    //
    leftSquareBracket,
    reverseSolidus,
    rightSquareBracket,
    lowLine,
    //
    latinSmallLetterRange,
    latinSmallLetterA,
    latinSmallLetterB,
    latinSmallLetterE,
    latinSmallLetterF,
    latinSmallLetterN,
    latinSmallLetterR,
    latinSmallLetterT,
    latinSmallLetterU,
    //
    leftCurlyBracket,
    rightCurlyBracket,
    dollarSign
} = ascii

export type StringToken = {
    readonly kind: 'string'
    readonly value: string
}

export type NumberToken = {
    readonly kind: 'number'
    readonly value: string
    readonly bf: bigfloatT.BigFloat
}

export type BigIntToken = {
    readonly kind: 'bigint'
    readonly value: bigint
}

export type ErrorToken = {readonly kind: 'error', message: ErrorMessage}

export type WhitespaceToken = {readonly kind: 'ws'}

export type NewLineToken = {readonly kind: 'nl'}

type TrueToken = {readonly kind: 'true'}

type FalseToken = {readonly kind: 'false'}

type NullToken = {readonly kind: 'null'}

type UndefinedToken = {readonly kind: 'undefined'}

type KeywordToken = |
    { readonly kind: 'arguments' | 'await' | 'break' | 'case' | 'catch' | 'class' | 'const' | 'continue' } |
    { readonly kind: 'debugger' | 'default' | 'delete' | 'do' | 'else' | 'enum' | 'eval' | 'export' } |
    { readonly kind: 'extends' | 'finally' | 'for' | 'function' | 'if' | 'implements' | 'import' | 'in' } |
    { readonly kind: 'instanceof' | 'interface' | 'let' | 'new' | 'package' | 'private' | 'protected' | 'public' } |
    { readonly kind: 'return' | 'static' | 'super' | 'switch' | 'this' | 'throw' | 'try' | 'typeof' } |
    { readonly kind: 'var' | 'void' | 'while' | 'with'  | 'yield' }

export type IdToken = {
    readonly kind: 'id'
    readonly value: string
}

type OperatorToken =|
    { readonly kind: '{' | '}' | ':' | ',' | '[' | ']' } |
    { readonly kind: '.' | '=' } |
    { readonly kind: '(' | ')' } |
    { readonly kind: '==' | '!=' | '===' | '!==' | '>' | '>=' | '<' | '<=' } |
    { readonly kind: '+' | '-' | '*' | '/' | '%' | '++' | '--' | '**' } |
    { readonly kind: '+=' | '-=' | '*=' | '/=' | '%=' | '**='} |
    { readonly kind: '&' | '|' | '^' | '~' | '<<' | '>>' | '>>>' } |
    { readonly kind: '&=' | '|=' | '^=' | '<<=' | '>>=' | '>>>='} |
    { readonly kind: '&&' | '||' | '!' | '??' } |
    { readonly kind: '&&=' | '||=' | '??=' } |
    { readonly kind: '?' | '?.' | '=>'}

export type CommentToken = {
    readonly kind: '//' | '/*'
    readonly value: string
}

export type JsToken = |
    KeywordToken |
    TrueToken |
    FalseToken |
    NullToken |
    WhitespaceToken |
    NewLineToken |
    StringToken |
    NumberToken |
    ErrorToken |
    IdToken |
    BigIntToken |
    UndefinedToken |
    OperatorToken |
    CommentToken

const rangeOneNine = range('19')

const rangeSetNewLine = [
    one(lf),
    one(cr)
]

const rangeSetWhiteSpace = [
    one(ht),
    one(space)
]

const rangeSetTerminalForNumber = [
    ...rangeSetWhiteSpace,
    ...rangeSetNewLine,
    one(exclamationMark),
    one(percentSign),
    one(ampersand),
    one(leftParenthesis),
    one(rightParenthesis),
    one(asterisk),
    one(comma),
    one(solidus),
    one(colon),
    one(lessThanSign),
    one(equalsSign),
    one(greaterThanSign),
    one(questionMark),
    one(circumflexAccent),
    one(leftSquareBracket),
    one(rightSquareBracket),
    one(leftCurlyBracket),
    one(verticalLine),
    one(rightCurlyBracket),
    one(tilde),
]

const rangeSmallAF = range('af')
const rangeCapitalAF = range('AF')

const rangeIdStart = [
    latinSmallLetterRange,
    latinCapitalLetterRange,
    one(lowLine),
    one(dollarSign)
]

const rangeOpStart = [
    one(exclamationMark),
    one(percentSign),
    one(ampersand),
    one(leftParenthesis),
    one(rightParenthesis),
    one(asterisk),
    one(plusSign),
    one(comma),
    one(hyphenMinus),
    one(fullStop),
    one(solidus),
    one(colon),
    one(lessThanSign),
    one(equalsSign),
    one(greaterThanSign),
    one(questionMark),
    one(circumflexAccent),
    one(leftSquareBracket),
    one(rightSquareBracket),
    one(leftCurlyBracket),
    one(verticalLine),
    one(rightCurlyBracket),
    one(tilde)
]

const rangeId = [digitRange, ...rangeIdStart]

type TokenizerStateWithPosition = {
    readonly state: TokenizerState,
    readonly line: number,
    readonly column: number
}

type TokenizerState = |
    InitialState |
    ParseIdState |
    ParseStringState |
    ParseEscapeCharState |
    ParseUnicodeCharState |
    ParseNumberState |
    InvalidNumberState |
    ParseOperatorState |
    ParseWhitespaceState |
    ParseNewLineState |
    ParseCommentState |
    EofState

type ErrorMessage = |
    '" are missing' |
    'unescaped character' |
    'invalid hex value' |
    'unexpected character' |
    'invalid number' |
    'invalid token' |
    '*\/ expected' |
    'unterminated string literal' |
    'eof'

type InitialState = { readonly kind: 'initial'}

type ParseIdState = { readonly kind: 'id', readonly value: string}

type ParseWhitespaceState = { readonly kind: 'ws'}

type ParseNewLineState = { readonly kind: 'nl'}

type ParseStringState = { readonly kind: 'string', readonly value: string}

type ParseEscapeCharState = { readonly kind: 'escapeChar', readonly value: string}

type ParseOperatorState = { readonly kind: 'op', readonly value: string}

type ParseCommentState = {
    readonly kind: '//' | '/*' | '/**'
    readonly value: string
    readonly newLine: boolean
}

type ParseUnicodeCharState = {
    readonly kind: 'unicodeChar'
    readonly value: string
    readonly unicode: number
    readonly hexIndex: number
}

type ParseNumberState = {
    readonly kind: 'number'
    readonly numberKind: '0' | 'int' | '.' | 'fractional' | 'e' | 'e+' | 'e-' | 'expDigits' | 'bigint'
    readonly value: string
    readonly b: ParseNumberBuffer
}

type ParseNumberBuffer = {
    readonly s: -1n | 1n
    readonly m: bigint
    readonly f: number
    readonly es: -1 | 1
    readonly e: number
}

type InvalidNumberState = { readonly kind: 'invalidNumber'}

type EofState = { readonly kind: 'eof'}

type CharCodeOrEof = number|null

type ToToken = (input: number) => readonly[list.List<JsToken>, TokenizerState]

type CreateToToken<T> = (state: T) => ToToken

type RangeFunc<T> = (def: CreateToToken<T>) => (RangeMapToToken<T>)

type RangeMapToToken<T> = range_map.RangeMapArray<CreateToToken<T>>

const appendChar
    : (old: string) => (input: number) => string
    = old => input => `${old}${fromCharCode(input)}`

const union
    : <T>(def: CreateToToken<T>) => (a: CreateToToken<T>) => (b: CreateToToken<T>) => CreateToToken<T>
    = def => a => b => {
    if (a === def || a === b) { return b }
    if (b === def) { return a }
    throw [a, b]
}

const rangeMapMerge
    : <T>(def:  CreateToToken<T>) => range_map.RangeMerge<CreateToToken<T>>
    = def => merge({
        union: union(def),
        equal: operator.strictEqual,
        def,
    })

const rangeFunc
    : <T>(r: _range.Range) => (f: CreateToToken<T>) => RangeFunc<T>
    = r => f => def => fromRange(def)(r)(f)

const scanRangeOp
    : <T>(def:  CreateToToken<T>) => (operator.Scan<RangeFunc<T>, RangeMapToToken<T>>)
    = def => f => [f(def), scanRangeOp(def)]

const reduceRangeMap
    : <T>(def: CreateToToken<T>) => (a: list.List<RangeFunc<T>>) => RangeMapToToken<T>
    = def => a => {
        const rm = scan(scanRangeOp(def))(a)
        return toArray(listReduce(rangeMapMerge(def))(empty)(rm))
    }

const scanRangeSetOp
    : <T>(def:  CreateToToken<T>) => (f:  CreateToToken<T>) => (operator.Scan<_range.Range, RangeMapToToken<T>>)
    = def => f => r => [fromRange(def)(r)(f), scanRangeSetOp(def)(f)]

const rangeSetFunc
    : <T>(rs: list.List<_range.Range>) => (f: CreateToToken<T>) => RangeFunc<T>
    = rs => f => def => {
        const rm = scan(scanRangeSetOp(def)(f))(rs)
        return toArray(listReduce(rangeMapMerge(def))(empty)(rm))
    }

const create = <T>(def: CreateToToken<T>) => (a: list.List<RangeFunc<T>>): CreateToToken<T> => {
    const i = reduceRangeMap(def)(a)
    const x
        : (v: number) => (i: RangeMapToToken<T>) => (v: T) => ToToken
        = get(def)
    return v => c => x(c)(i)(v)(c)
}

const digitToBigInt
    : (digit: number) => bigint
    = d => BigInt(d - digit0)

const startNumber
    : (digit: number) => ParseNumberBuffer
    = digit => ({ s: 1n, m: digitToBigInt(digit), f: 0, es: 1, e: 0 })

/*
const startNegativeNumber
    : ParseNumberBuffer
    = { s: -1n, m: 0n, f: 0, es: 1, e: 0 }
*/

const addIntDigit
    : (digit: number) => (b: ParseNumberBuffer) => ParseNumberBuffer
    = digit => b => ({ ... b, m: b.m * 10n + digitToBigInt(digit)})

const addFracDigit
    : (digit: number) => (b: ParseNumberBuffer) => ParseNumberBuffer
    = digit => b => ({ ... b, m: b.m * 10n + digitToBigInt(digit), f: b.f - 1})

const addExpDigit
    : (digit: number) => (b: ParseNumberBuffer) => ParseNumberBuffer
    = digit => b =>  ({ ... b, e: b.e * 10 + digit - digit0})

const bufferToNumberToken
    : (s: ParseNumberState) => JsToken
    = ({numberKind, value, b}) => {
        if (numberKind === 'bigint')
            return { kind: 'bigint', value: b.s * b.m }
        return { kind: 'number', value: value, bf: [b.s * b.m, b.f + b.es * b.e] }
    }

/**
 * @link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Lexical_grammar#keywords
 */
const keywordEntries : list.List<map.Entry<JsToken>> = [
    ['arguments', { kind: 'arguments'}],
    ['await', { kind: 'await'}],
    ['break', { kind: 'break'}],
    ['case', { kind: 'case'}],
    ['catch', { kind: 'catch'}],
    ['class', { kind: 'class'}],
    ['const', { kind: 'const'}],
    ['continue', { kind: 'continue'}],
    ['debugger', { kind: 'debugger'}],
    ['default', { kind: 'default'}],
    ['delete', { kind: 'delete'}],
    ['do', { kind: 'do'}],
    ['else', { kind: 'else'}],
    ['enum', { kind: 'enum'}],
    ['eval', { kind: 'eval'}],
    ['export', { kind: 'export'}],
    ['extends', { kind: 'extends'}],
    ['false', { kind: 'false'}],
    ['finally', { kind: 'finally'}],
    ['for', { kind: 'for'}],
    ['function', { kind: 'function'}],
    ['if', { kind: 'if'}],
    ['implements', { kind: 'implements'}],
    ['import', { kind: 'import'}],
    ['in', { kind: 'in'}],
    ['instanceof', { kind: 'instanceof'}],
    ['interface', { kind: 'interface'}],
    ['let', { kind: 'let'}],
    ['new', { kind: 'new'}],
    ['null', { kind: 'null'}],
    ['package', { kind: 'package'}],
    ['private', { kind: 'private'}],
    ['protected', { kind: 'protected'}],
    ['public', { kind: 'public'}],
    ['return', { kind: 'return'}],
    ['static', { kind: 'static'}],
    ['super', { kind: 'super'}],
    ['switch', { kind: 'switch'}],
    ['this', { kind: 'this'}],
    ['throw', { kind: 'throw'}],
    ['true', { kind: 'true'}],
    ['try', { kind: 'try'}],
    ['typeof', { kind: 'typeof'}],
    ['undefined', { kind: 'undefined'}],
    ['var', { kind: 'var'}],
    ['void', { kind: 'void'}],
    ['while', { kind: 'while'}],
    ['with', { kind: 'with'}],
    ['yield', { kind: 'yield'}],
]

const keywordMap = map.fromEntries(keywordEntries)

export const isKeywordToken
    : (token: JsToken) => boolean
    = token => at(token.kind)(keywordMap) !== null

/**
 * @link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators
 */
const operatorEntries: list.List<map.Entry<JsToken>> = [
    ['!', { kind: '!'}],
    ['!=', { kind: '!='}],
    ['!==', { kind: '!=='}],
    ['%', { kind: '%'}],
    ['%=', { kind: '%='}],
    ['&', { kind: '&'}],
    ['&&', { kind: '&&'}],
    ['&&=', { kind: '&&='}],
    ['&=', { kind: '&='}],
    ['(', { kind: '('}],
    [')', { kind: ')'}],
    ['*', { kind: '*'}],
    ['**', { kind: '**'}],
    ['**=', { kind: '**='}],
    ['*=', { kind: '*='}],
    ['+', { kind: '+'}],
    ['++', { kind: '++'}],
    ['+=', { kind: '+='}],
    [',', { kind: ','}],
    ['-', { kind: '-'}],
    ['--', { kind: '--'}],
    ['-=', { kind: '-='}],
    ['.', { kind: '.'}],
    ['/', { kind: '/'}],
    ['/=', { kind: '/='}],
    [':', { kind: ':'}],
    ['<', { kind: '<'}],
    ['<<', { kind: '<<'}],
    ['<<=', { kind: '<<='}],
    ['<=', {kind: '<='}],
    ['=', { kind: '='}],
    ['==', { kind: '=='}],
    ['===', { kind: '==='}],
    ['=>', {kind: '=>'}],
    ['>', { kind: '>'}],
    ['>=', { kind: '>='}],
    ['>>', { kind: '>>'}],
    ['>>=', {kind: '>>='}],
    ['>>>', {kind: '>>>'}],
    ['>>>=', {kind: '>>>='}],
    ['?', { kind: '?'}],
    ['?.', { kind: '?.'}],
    ['??', { kind: '??'}],
    ['??=', { kind: '??='}],
    ['^', { kind: '^'}],
    ['^=', { kind: '^='}],
    ['[', { kind: '['}],
    [']', { kind: ']'}],
    ['{', { kind: '{'}],
    ['|', { kind: '|'}],
    ['|=', { kind: '|='}],
    ['||', { kind: '||'}],
    ['||=', { kind: '||='}],
    ['}', { kind: '}'}],
    ['~', { kind: '~' }]
]

const operatorMap = map.fromEntries(operatorEntries)

const getOperatorToken
    : (op: string) => JsToken
    = op => at(op)(operatorMap) ?? { kind: 'error', message: 'invalid token' }

const hasOperatorToken
    : (op: string) => boolean
    = op => at(op)(operatorMap) !== null

const initialStateOp
    : (state: InitialState) => (input: number) => readonly[list.List<JsToken>, TokenizerState]
    = create((state: TokenizerState) => () => [[{ kind: 'error', message: 'unexpected character' }], state])([
        rangeFunc<TokenizerState>(rangeOneNine)(() => input => [empty, { kind: 'number', value: fromCharCode(input), b: startNumber(input), numberKind: 'int' }]),
        rangeSetFunc<TokenizerState>(rangeIdStart)(() => input => [empty, { kind: 'id', value: fromCharCode(input) }]),
        rangeSetFunc<TokenizerState>(rangeSetWhiteSpace)(() => () => [empty, { kind: 'ws' }]),
        rangeSetFunc<TokenizerState>(rangeSetNewLine)(() => () => [empty, { kind: 'nl' }]),
        rangeFunc<TokenizerState>(one(quotationMark))(() => () => [empty, { kind: 'string', value: '' }]),
        rangeFunc<TokenizerState>(one(digit0))(() => input => [empty, { kind: 'number', value: fromCharCode(input), b: startNumber(input), numberKind: '0' }]),
        rangeSetFunc<TokenizerState>(rangeOpStart)(() => input => [empty, { kind: 'op', value: fromCharCode(input) }])
    ])

const invalidNumberToToken
    : (state: ParseNumberState) => (input: number) => readonly[list.List<JsToken>, TokenizerState]
    = () => input => {
        const next = tokenizeOp({ kind: 'initial' })(input)
        return [{ first: { kind: 'error', message: 'invalid number' }, tail: next[0] }, next[1]]
    }

const fullStopToToken
    : (state: ParseNumberState) => (input: number) => readonly[list.List<JsToken>, TokenizerState]
    = state => input => {
        switch (state.numberKind) {
            case '0':
            case 'int': return [empty, { kind: 'number', value: appendChar(state.value)(input), b: state.b, numberKind: '.' }]
            default: return tokenizeOp({ kind: 'invalidNumber' })(input)
        }
    }

const digit0ToToken
    : (state: ParseNumberState) => (input: number) => readonly[list.List<JsToken>, TokenizerState]
    = state => input => {
        switch (state.numberKind) {
            case '0': return tokenizeOp({ kind: 'invalidNumber' })(input)
            case '.':
            case 'fractional': return [empty, { kind: 'number', value: appendChar(state.value)(input), b: addFracDigit(input)(state.b), numberKind: 'fractional' }]
            case 'e':
            case 'e+':
            case 'e-':
            case 'expDigits': return [empty, { kind: 'number', value: appendChar(state.value)(input), b: addExpDigit(input)(state.b), numberKind: 'expDigits' }]
            default: return [empty, { kind: 'number', value: appendChar(state.value)(input), b: addIntDigit(input)(state.b), numberKind: state.numberKind }]
        }
    }

const digit19ToToken
    : (state: ParseNumberState) => (input: number) => readonly[list.List<JsToken>, TokenizerState]
    = state => input => {
        switch (state.numberKind) {
            case '0': return tokenizeOp({ kind: 'invalidNumber' })(input)
            case '.':
            case 'fractional': return [empty, { kind: 'number', value: appendChar(state.value)(input), b: addFracDigit(input)(state.b), numberKind: 'fractional' }]
            case 'e':
            case 'e+':
            case 'e-':
            case 'expDigits': return [empty, { kind: 'number', value: appendChar(state.value)(input), b: addExpDigit(input)(state.b), numberKind: 'expDigits' }]
            default: return [empty, { kind: 'number', value: appendChar(state.value)(input), b: addIntDigit(input)(state.b), numberKind: 'int' }]
        }
    }

const expToToken
    : (state: ParseNumberState) => (input: number) => readonly[list.List<JsToken>, TokenizerState]
    = state => input => {
        switch (state.numberKind) {
            case '0':
            case 'int':
            case 'fractional': return [empty, { kind: 'number', value: appendChar(state.value)(input), b: state.b, numberKind: 'e' }]
            default: return tokenizeOp({ kind: 'invalidNumber' })(input)
        }
    }

const hyphenMinusToToken
    : (state: ParseNumberState) => (input: number) => readonly[list.List<JsToken>, TokenizerState]
    = state => input => {
        switch (state.numberKind) {
            case 'e': return [empty, { kind: 'number', value: appendChar(state.value)(input), b: { ... state.b, es: -1}, numberKind: 'e-' }]
            default: return terminalToToken(state)(input)
        }
    }

const plusSignToToken
    : (state: ParseNumberState) => (input: number) => readonly[list.List<JsToken>, TokenizerState]
    = state => input => {
        switch (state.numberKind) {
            case 'e': return [empty, { kind: 'number', value: appendChar(state.value)(input), b: state.b, numberKind: 'e+' }]
            default: return tokenizeOp({ kind: 'invalidNumber' })(input)
        }
    }

const terminalToToken
    : (state: ParseNumberState) => (input: number) => readonly[list.List<JsToken>, TokenizerState]
    = state => input => {
        switch (state.numberKind) {
            case '.':
            case 'e':
            case 'e+':
            case 'e-':
                {
                    const next = tokenizeOp({ kind: 'initial' })(input)
                    return [{ first: { kind: 'error', message: 'invalid number' }, tail: next[0] }, next[1]]
                }
            default:
                {
                    const next = tokenizeOp({ kind: 'initial' })(input)
                    return [{ first: bufferToNumberToken(state), tail: next[0] }, next[1]]
                }
        }
    }

const bigintToToken
    : (state: ParseNumberState) => (input: number) => readonly[list.List<JsToken>, TokenizerState]
    = state => input => {
        switch (state.numberKind) {
            case '0':
            case 'int':
                {
                    return [empty, { kind: 'number', value: state.value, b: state.b, numberKind: 'bigint' }]
                }
            default:
                {
                    const next = tokenizeOp({ kind: 'initial' })(input)
                    return [{ first: { kind: 'error', message: 'invalid number' }, tail: next[0] }, next[1]]
                }
        }
    }

const parseNumberStateOp
    : (state: ParseNumberState) => (input: number) => readonly[list.List<JsToken>, TokenizerState]
    = create(invalidNumberToToken)([
        rangeFunc<ParseNumberState>(one(fullStop))(fullStopToToken),
        rangeFunc<ParseNumberState>(one(digit0))(digit0ToToken),
        rangeFunc<ParseNumberState>(rangeOneNine)(digit19ToToken),
        rangeSetFunc<ParseNumberState>([one(latinSmallLetterE), one(latinCapitalLetterE)])(expToToken),
        rangeFunc<ParseNumberState>(one(hyphenMinus))(hyphenMinusToToken),
        rangeFunc<ParseNumberState>(one(plusSign))(plusSignToToken),
        rangeSetFunc<ParseNumberState>(rangeSetTerminalForNumber)(terminalToToken),
        rangeFunc<ParseNumberState>(one(latinSmallLetterN))(bigintToToken),
    ])

const invalidNumberStateOp
    : (state: InvalidNumberState) => (input: number) => readonly[list.List<JsToken>, TokenizerState]
    = create(() => () => [empty, { kind: 'invalidNumber' }])([
        rangeSetFunc(rangeSetTerminalForNumber)(() => input => {
            const next = tokenizeOp({ kind: 'initial' })(input)
            return [{ first: { kind: 'error', message: 'invalid number' }, tail: next[0] }, next[1]]
        })
    ])

const parseStringStateOp
    : (state: ParseStringState) => (input: number) => readonly[list.List<JsToken>, TokenizerState]
    = create((state: ParseStringState) => input => [empty, { kind: 'string', value: appendChar(state.value)(input) }])([
        rangeFunc<ParseStringState>(one(quotationMark))(state => () => [[{ kind: 'string', value: state.value }], { kind: 'initial' }]),
        rangeFunc<ParseStringState>(one(reverseSolidus))(state => () => [empty, { kind: 'escapeChar', value: state.value }]),
        rangeSetFunc<ParseStringState>(rangeSetNewLine)(() => () => [[{ kind: 'error', message: 'unterminated string literal'}], { kind: 'nl'}])
    ])

const parseEscapeDefault
    : (state: ParseEscapeCharState) => (input: number) => readonly[list.List<JsToken>, TokenizerState]
    = state => input => {
        const next = tokenizeOp({ kind: 'string', value: state.value })(input)
        return [{ first: { kind: 'error', message: 'unescaped character' }, tail: next[0] }, next[1]]
    }

const parseEscapeCharStateOp
    : (state: ParseEscapeCharState) => (input: number) => readonly[list.List<JsToken>, TokenizerState]
    = create(parseEscapeDefault)([
        rangeSetFunc<ParseEscapeCharState>([one(quotationMark), one(reverseSolidus), one(solidus)])(state => input => [empty, { kind: 'string', value: appendChar(state.value)(input) }]),
        rangeFunc<ParseEscapeCharState>(one(latinSmallLetterB))(state => () => [empty, { kind: 'string', value: appendChar(state.value)(backspace) }]),
        rangeFunc<ParseEscapeCharState>(one(latinSmallLetterF))(state => () => [empty, { kind: 'string', value: appendChar(state.value)(ff) }]),
        rangeFunc<ParseEscapeCharState>(one(latinSmallLetterN))(state => () => [empty, { kind: 'string', value: appendChar(state.value)(lf) }]),
        rangeFunc<ParseEscapeCharState>(one(latinSmallLetterR))(state => () => [empty, { kind: 'string', value: appendChar(state.value)(cr) }]),
        rangeFunc<ParseEscapeCharState>(one(latinSmallLetterT))(state => () => [empty, { kind: 'string', value: appendChar(state.value)(ht) }]),
        rangeFunc<ParseEscapeCharState>(one(latinSmallLetterU))(state => () => [empty, { kind: 'unicodeChar', value: state.value, unicode: 0, hexIndex: 0 }]),
    ])

const parseUnicodeCharDefault
    : (state: ParseUnicodeCharState) => (input: number) => readonly[list.List<JsToken>, TokenizerState]
    = state => input => {
        const next = tokenizeOp({ kind: 'string', value: state.value })(input)
        return [{ first: { kind: 'error', message: 'invalid hex value' }, tail: next[0] }, next[1]]
    }

const parseUnicodeCharHex
    : (offser: number) => (state: ParseUnicodeCharState) => (input: number) => readonly[list.List<JsToken>, TokenizerState]
    = offset => state => input => {
        const hexValue = input - offset
        const newUnicode = state.unicode | (hexValue << (3 - state.hexIndex) * 4)
        return [empty, state.hexIndex === 3 ?
            { kind: 'string', value: appendChar(state.value)(newUnicode) } :
            { kind: 'unicodeChar', value: state.value, unicode: newUnicode, hexIndex: state.hexIndex + 1 }]
    }

const parseUnicodeCharStateOp
    : (state: ParseUnicodeCharState) => (input: number) => readonly[list.List<JsToken>, TokenizerState]
    = create(parseUnicodeCharDefault)([
        rangeFunc<ParseUnicodeCharState>(digitRange)(parseUnicodeCharHex(digit0)),
        rangeFunc<ParseUnicodeCharState>(rangeSmallAF)(parseUnicodeCharHex(latinSmallLetterA - 10)),
        rangeFunc<ParseUnicodeCharState>(rangeCapitalAF)(parseUnicodeCharHex(latinCapitalLetterA - 10))
    ])

const idToToken
    : (s: string) => JsToken
    = s => at(s)(keywordMap) ?? { kind: 'id', value: s }

const parseIdDefault
    : (state: ParseIdState) => (input: number) => readonly[list.List<JsToken>, TokenizerState]
    = state => input => {
        const keyWordToken = idToToken(state.value)
        const next = tokenizeOp({ kind: 'initial' })(input)
        return [{ first: keyWordToken, tail: next[0] }, next[1]]
    }

const parseIdStateOp
    : (state: ParseIdState) => (input: number) => readonly[list.List<JsToken>, TokenizerState]
    = create(parseIdDefault)([
        rangeSetFunc<ParseIdState>(rangeId)(state => input => [empty, { kind: 'id', value: appendChar(state.value)(input) }])
    ])

const parseOperatorStateOp
    : (state: ParseOperatorState) => (input: number) => readonly[list.List<JsToken>, TokenizerState]
    = state => input => {
        const nextStateValue = appendChar(state.value)(input)
        switch (nextStateValue)
        {
            case '//': return [empty, { kind: '//', value: '', newLine: false }]
            case '/*': return [empty, { kind: '/*', value: '', newLine: false }]
            default: {
                if (hasOperatorToken(nextStateValue))
                    return [empty, { kind: 'op', value: nextStateValue }]
                const next = tokenizeOp({ kind: 'initial' })(input)
                return [{ first: getOperatorToken(state.value), tail: next[0] }, next[1]]
            }
        }
    }

const parseSinglelineCommentStateOp
    : (state: ParseCommentState) => (input: number) => readonly[list.List<JsToken>, TokenizerState]
    = create((state: ParseCommentState) => input => [empty, { ...state, value: appendChar(state.value)(input) }])([
        rangeSetFunc<ParseCommentState>(rangeSetNewLine)(state => () => [[{ kind: '//', value: state.value }], { kind: 'nl' }])
    ])

const parseMultilineCommentStateOp
    : (state: ParseCommentState) => (input: number) => readonly[list.List<JsToken>, TokenizerState]
    = create((state: ParseCommentState) => input => [empty, { ...state, value: appendChar(state.value)(input) }])([
        rangeFunc<ParseCommentState>(one(asterisk))(state => () => [empty, { ...state, kind: '/**' }]),
        rangeSetFunc<ParseCommentState>(rangeSetNewLine)(state => input => [empty, { ...state, value: appendChar(state.value)(input), newLine: true }]),
    ])

const parseMultilineCommentAsteriskStateOp
    : (state: ParseCommentState) => (input: number) => readonly[list.List<JsToken>, TokenizerState]
    = create((state: ParseCommentState) => input => [empty, { ...state, kind: '/*', value: appendChar(appendChar(state.value)(asterisk))(input)}])([
        rangeFunc<ParseCommentState>(one(asterisk))(state => () => [empty, { ...state, value: appendChar(state.value)(asterisk) }]),
        rangeSetFunc<ParseCommentState>(rangeSetNewLine)(state => input => [empty, { kind: '/*', value: appendChar(appendChar(state.value)(asterisk))(input), newLine: true }]),
        rangeFunc<ParseCommentState>(one(solidus))(state => () => {
            const tokens
                : list.List<JsToken>
                = state.newLine ? [{ kind: '/*', value: state.value },  { kind: 'nl' }] : [{ kind: '/*', value: state.value }]
            return [tokens, { kind: 'initial' }]
        })
    ])

const parseWhitespaceDefault
    : (state: ParseWhitespaceState) => (input: number) => readonly[list.List<JsToken>, TokenizerState]
    = () => input => {
        const next = tokenizeOp({ kind: 'initial' })(input)
        return [{ first: { kind: 'ws' }, tail: next[0] }, next[1]]
    }

const parseWhitespaceStateOp
    : (state: ParseWhitespaceState) => (input: number) => readonly[list.List<JsToken>, TokenizerState]
    = create(parseWhitespaceDefault)([
        rangeSetFunc<ParseWhitespaceState>(rangeSetWhiteSpace)(state => () => [empty, state]),
        rangeSetFunc<ParseWhitespaceState>(rangeSetNewLine)(() => () => [empty, { kind: 'nl' }])
    ])

const parseNewLineDefault
    : (state: ParseNewLineState) => (input: number) => readonly[list.List<JsToken>, TokenizerState]
    = _ => input => {
        const next = tokenizeOp({ kind: 'initial' })(input)
        return [{ first: { kind: 'nl' }, tail: next[0] }, next[1]]
    }

const parseNewLineStateOp
    : (state: ParseNewLineState) => (input: number) => readonly[list.List<JsToken>, TokenizerState]
    = create(parseNewLineDefault)([
        rangeSetFunc<ParseNewLineState>(rangeSetWhiteSpace)(state => () => [empty, state]),
        rangeSetFunc<ParseNewLineState>(rangeSetNewLine)(state => () => [empty, state])
    ])

const eofStateOp
    : (state: EofState) => (input: number) => readonly[list.List<JsToken>, TokenizerState]
    = create((state: EofState) => () => [[{ kind: 'error', message: 'eof' }], state])([])

const tokenizeCharCodeOp
    :operator.StateScan<number, TokenizerState, list.List<JsToken>>
    = state => {
        switch (state.kind) {
            case 'initial': return initialStateOp(state)
            case 'id': return parseIdStateOp(state)
            case 'string': return parseStringStateOp(state)
            case 'escapeChar': return parseEscapeCharStateOp(state)
            case 'unicodeChar': return parseUnicodeCharStateOp(state)
            case 'invalidNumber': return invalidNumberStateOp(state)
            case 'number': return parseNumberStateOp(state)
            case 'op': return parseOperatorStateOp(state)
            case '//': return parseSinglelineCommentStateOp(state)
            case '/*': return parseMultilineCommentStateOp(state)
            case '/**': return parseMultilineCommentAsteriskStateOp(state)
            case 'ws': return parseWhitespaceStateOp(state)
            case 'nl': return parseNewLineStateOp(state)
            case 'eof': return eofStateOp(state)
        }
    }

const tokenizeEofOp
    : (state: TokenizerState) => readonly[list.List<JsToken>, TokenizerState]
    = state => {
        switch (state.kind) {
            case 'initial': return [empty, { kind: 'eof' }]
            case 'id': return [[idToToken(state.value)], { kind: 'eof' }]
            case 'string':
            case 'escapeChar':
            case 'unicodeChar': return [[{ kind: 'error', message: '" are missing' }], { kind: 'eof' }]
            case 'invalidNumber': return [[{ kind: 'error', message: 'invalid number' }], { kind: 'eof' }]
            case 'number':
                switch (state.numberKind) {
                    case '.':
                    case 'e':
                    case 'e+':
                    case 'e-': return [[{ kind: 'error', message: 'invalid number' }], { kind: 'eof', }]
                }
                return [[bufferToNumberToken(state)], { kind: 'eof' }]
            case 'op': return [[getOperatorToken(state.value)], { kind: 'eof' }]
            case '//': return [[{kind: '//', value: state.value}], { kind: 'eof' }]
            case '/*':
            case '/**': return [[{ kind: 'error', message: '*/ expected' }], { kind: 'eof', }]
            case 'ws': return [[{kind: 'ws'}], { kind: 'eof' }]
            case 'nl': return [[{kind: 'nl'}], { kind: 'eof' }]
            case 'eof': return [[{ kind: 'error', message: 'eof' }], state]
        }
    }

const tokenizeOp
    : operator.StateScan<CharCodeOrEof, TokenizerState, list.List<JsToken>>
    = state => input => input === null ? tokenizeEofOp(state) : tokenizeCharCodeOp(state)(input)

const tokenizeWithPositionOp
    : operator.StateScan<CharCodeOrEof, TokenizerStateWithPosition, list.List<JsToken>>
    = ({state, line, column}) => input => {
        if (input == null)
        {
            const newState = tokenizeEofOp(state) 
            return [ newState[0], { state: newState[1], line, column}]
        }

        const newState = tokenizeCharCodeOp(state)(input)
        const isNewLine = input == lf || input == cr
        return [ newState[0], { state: newState[1], line: isNewLine ? line + 1 : line, column: isNewLine ? 0 : column + 1}]
    } 

const scanTokenize = stateScan(tokenizeWithPositionOp)

const initial = scanTokenize({state: { kind: 'initial' }, line: 0, column: 0})

export const tokenize
    = (input: list.List<number>): list.List<JsToken> =>
        flat(initial(flat<number|null>([input satisfies list.List<CharCodeOrEof>, [null]])))
