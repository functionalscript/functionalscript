/**
 * Tokenizer for JSON lexical analysis.
 *
 * Scans [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259)'s lexical grammar
 * directly, over UTF-16 code units:
 *
 * ```text
 * ws     ::= (' ' | '\t' | '\n' | '\r')*
 * token  ::= '{' | '}' | '[' | ']' | ':' | ',' | 'true' | 'false' | 'null'
 *          | string | number
 * string ::= '"' char* '"'
 * char   ::= <any code unit except '"', '\', and U+0000-U+001F>
 *          | '\' ('"' | '\' | '/' | 'b' | 'f' | 'n' | 'r' | 't' | 'u' hex hex hex hex)
 * number ::= '-'? int frac? exp?
 * int    ::= '0' | [1-9] [0-9]*
 * frac   ::= '.' [0-9]+
 * exp    ::= ('e' | 'E') ('+' | '-')? [0-9]+
 * ```
 *
 * It takes no dependency on `fjs/js/tokenizer`, whose token vocabulary must
 * grow with FunctionalScript, and none on `fjs/bnf`. The one module it shares
 * with JavaScript is
 * [`fjs/js/string_escape`](../../../js/string_escape/module.f.mjs), which is
 * not JavaScript's escape table but the eight escapes the two languages share,
 * frozen by both specifications — so the serializer and this scanner cannot
 * drift apart.
 *
 * Code units, not code points, throughout: the entry point is fed
 * `stringToList`, and `\uXXXX` is a code-unit escape, so `"😀"` and
 * `"😀"` decode alike and the lone surrogate `"\ud800"` — which JSON
 * permits and no code point can represent — survives.
 *
 * @module
 *
 * @import { List } from '../../../types/list/types.ts'
 * @import { U16 } from '../../../text/utf16/types.ts'
 * @import { Range } from '../../../types/range/types.ts'
 * @import { Scan, ScanResult, JsonToken, JsonErrorMessage, NumberState, StringState, _TokenizerState } from './types.ts'
 */

import { concat, empty, flat, stateScan } from '../../../types/list/module.f.mjs'
import { escapeToCodePoint } from '../../../js/string_escape/module.f.mjs'
import {
    colon,
    comma,
    cr,
    digitRange,
    dollarSign,
    fullStop,
    hexDigitValue,
    ht,
    hyphenMinus,
    latinCapitalLetterE,
    latinCapitalLetterRange,
    latinSmallLetterE,
    latinSmallLetterRange,
    latinSmallLetterU,
    leftCurlyBracket,
    leftSquareBracket,
    lf,
    lowLine,
    plusSign,
    quotationMark,
    reverseSolidus,
    rightCurlyBracket,
    rightSquareBracket,
    space,
} from '../../../text/ascii/module.f.mjs'

const { fromCharCode } = String

/** @type {(r: Range) => (c: U16) => boolean} */
const inRange = ([lo, hi]) => c => lo <= c && c <= hi

const isDigit = inRange(digitRange)

const isLatinCapitalLetter = inRange(latinCapitalLetterRange)

const isLatinSmallLetter = inRange(latinSmallLetterRange)

/**
 * `[A-Za-z_$]`, with digits deliberately absent: a digit starts a *number*, so
 * `tru3` is one word run while `0abc` is a number followed by one.
 *
 * @type {(c: U16) => boolean}
 */
const isWordStart = c =>
    isLatinCapitalLetter(c) || isLatinSmallLetter(c) || c === lowLine || c === dollarSign

/** @type {(c: U16) => boolean} */
const isWordChar = c => isWordStart(c) || isDigit(c)

/** The first code unit outside the C0 control block. */
const firstNonControl = 0x20

/**
 * A set of code units, given as the string spelling them, lifted to a
 * predicate that also answers for end of input.
 *
 * @type {(chars: string) => (c: U16 | null) => boolean}
 */
const codeUnitSet = chars => {
    const set = new Set(chars.split('').map(c => c.charCodeAt(0)))
    return c => c === null || set.has(c)
}

/**
 * Where a **complete** number may end and still be accepted.
 *
 * This set and the recovery set below are the *caller's* policy, not the
 * scanner's: both are JavaScript operator tables reproduced for compatibility,
 * sitting where a language's own delimiters belong. Keeping them here is what
 * lets `fjs/media/datajs` apply its own — that set is this one plus `;`, so
 * `const $0=1;` and `export default 1;` both end their number at the `;` —
 * without parameterizing the grammar.
 *
 * Reproduced exactly rather than narrowed to JSON's own delimiters: accepting
 * *more* characters would stop `12"a"` erroring at all, and gratuitously
 * turning well-formed numbers into errors is churn a port should not
 * introduce. Narrowing it is a deliberate change with proofs of its own.
 *
 * `-` is in this set and must be: `10-0` is the two numbers `10` and `-0`,
 * which a proof pins.
 *
 * `;` is in it too. The design's list omitted it from both sets, and both
 * omissions are measurable errors rather than choices: `;` is a JavaScript
 * punctuator, so it is in `rangeSetTerminalForNumber` like every other
 * character here, and today `12;1` is `number 12`, an error, then `number 1`.
 * Dropping it would have turned an accepted number into an error, which
 * invariant 2 forbids outright.
 */
const isNumberTerminator = codeUnitSet(' \t\n\r!%&()*,-/:;<=>?[]^{|}~')

/**
 * Where a number lexeme in **recovery** stops. Today's set exactly — which is
 * the accepting set *minus* `-`.
 *
 * The missing `-` is the one boundary whose absence loses a token: `00-2`
 * reports one error and the well-formed `-2` never reaches the caller. Adding
 * it does not fix that, it moves it — `00-"/1` then loses its `number 1`,
 * because the re-dispatched `-` meets `"` as an incomplete stop and hands the
 * quote to a string scan that eats the rest. So the loss is reproduced rather
 * than traded, and fixing it belongs in its own change starting from that
 * counterexample.
 *
 * `;` is here for the reason given above, and its presence is why `00;1` is
 * three tokens today rather than one.
 */
const isRecoveryBoundary = codeUnitSet(' \t\n\r!%&()*,/:;<=>?[]^{|}~')

/**
 * The characters maximal munch takes past the grammar.
 *
 * A character the number grammar *cannot* consume is still absorbed when it
 * looks like number syntax, which moves the scan into `recovery` — a
 * non-accepting state the lexeme can no longer end in. One rule covers every
 * phase: in any state that has already consumed a digit or the point, a
 * character in `0-9 . e E +` that the grammar cannot consume is absorbed.
 * `-` is never absorbed; it terminates.
 *
 * That reproduces today's behavior phase for phase — `12+1`, `00`, `1..1`,
 * `1.5+1`, `1ee1`, `1e++1` and `1e5.1` are each one error — and the pattern
 * behind it is one grammar's leftovers seen through another: `+`, a second
 * `.`, a second `e` are all *number* characters, so the scan keeps eating them
 * and then reports the whole run invalid.
 *
 * @type {(c: U16) => boolean}
 */
const isAbsorbable = c =>
    isDigit(c) || c === fullStop || c === latinSmallLetterE || c === latinCapitalLetterE || c === plusSign

/** @type {(state: NumberState) => ScanResult<NumberState>} */
const numberStopped = state => ({ kind: 'stopped', state })

/** @type {(kind: NumberState['kind'], lexeme: string, c: U16) => ScanResult<NumberState>} */
const numberConsumed = (kind, lexeme, c) =>
    ({ kind: 'consumed', state: { kind, lexeme: `${lexeme}${fromCharCode(c)}` } })

/**
 * True when the integer part read so far is a lone `0`, which
 * `int ::= '0' | [1-9] [0-9]*` cannot extend.
 *
 * The distinction lives in the lexeme rather than in a `kind` of its own: no
 * caller wants it — `0n` is as valid a bigint as `12n`, so a wrapper's
 * interception point is exactly `int` — and splitting the variant would make
 * that wrapper match two kinds to ask one question.
 *
 * @type {(lexeme: string) => boolean}
 */
const isLeadingZero = lexeme => lexeme === '0' || lexeme === `${fromCharCode(hyphenMinus)}0`

/**
 * Scans one JSON number, consuming its own opening character — the `-` or the
 * first digit — so there is no "already consumed" ambiguity at the boundary.
 *
 * It emits no token and applies no terminator policy. On `stopped` the caller
 * holds the character and the state, and decides: a complete lexeme (`int`,
 * `frac`, `expDigits`) followed by one of *its* terminators is a number,
 * anything else is one error, and the character is re-dispatched either way.
 *
 * `recovery` is **terminal**: it returns `stopped` for every input. Recovery
 * ends at a boundary and the boundary set is the caller's — `00;1` consumes
 * the `;` under JSON's set and must stop before it under DataJS's — so a
 * scanner that consumed during recovery would have to know one set or the
 * other, which is exactly the delimiter knowledge that does not belong here.
 *
 * @type {Scan<NumberState>}
 */
export const scanNumber = state => input => {
    const { kind, lexeme } = state
    if (input === null || kind === 'recovery') { return numberStopped(state) }
    const c = input
    switch (kind) {
        // `start` absorbs nothing: nothing has been read to absorb into, which
        // is what keeps an untouched scan from posing as an interception site.
        case 'start': return c === hyphenMinus ? numberConsumed('sign', lexeme, c)
            : isDigit(c) ? numberConsumed('int', lexeme, c)
                : numberStopped(state)
        // The bare-sign state absorbs nothing either, so `-"a"` is an
        // incomplete stop that re-dispatches the quote rather than eating it.
        case 'sign': return isDigit(c) ? numberConsumed('int', lexeme, c) : numberStopped(state)
        case 'int': return isDigit(c) && !isLeadingZero(lexeme) ? numberConsumed('int', lexeme, c)
            : c === fullStop ? numberConsumed('point', lexeme, c)
                : c === latinSmallLetterE || c === latinCapitalLetterE ? numberConsumed('exp', lexeme, c)
                    : isAbsorbable(c) ? numberConsumed('recovery', lexeme, c)
                        : numberStopped(state)
        case 'point': return isDigit(c) ? numberConsumed('frac', lexeme, c)
            : isAbsorbable(c) ? numberConsumed('recovery', lexeme, c)
                : numberStopped(state)
        case 'frac': return isDigit(c) ? numberConsumed('frac', lexeme, c)
            : c === latinSmallLetterE || c === latinCapitalLetterE ? numberConsumed('exp', lexeme, c)
                : isAbsorbable(c) ? numberConsumed('recovery', lexeme, c)
                    : numberStopped(state)
        // `+` and `-` are the exponent's own sign here, so the terminator test
        // never fires mid-lexeme: the `-` in `1e-5` is grammar.
        case 'exp': return isDigit(c) ? numberConsumed('expDigits', lexeme, c)
            : c === plusSign || c === hyphenMinus ? numberConsumed('expSign', lexeme, c)
                : isAbsorbable(c) ? numberConsumed('recovery', lexeme, c)
                    : numberStopped(state)
        case 'expSign': return isDigit(c) ? numberConsumed('expDigits', lexeme, c)
            : isAbsorbable(c) ? numberConsumed('recovery', lexeme, c)
                : numberStopped(state)
        default: return isDigit(c) ? numberConsumed('expDigits', lexeme, c)
            : isAbsorbable(c) ? numberConsumed('recovery', lexeme, c)
                : numberStopped(state)
    }
}

/** The initial state of a number scan: nothing consumed. */
export const numberStart = /** @type {NumberState} */({ kind: 'start', lexeme: '' })

/** The number states a complete lexeme can rest in. */
const numberAccepts = new Set(['int', 'frac', 'expDigits'])

/** @type {(state: StringState) => ScanResult<StringState>} */
const stringStopped = state => ({ kind: 'stopped', state })

/** @type {(state: StringState) => ScanResult<StringState>} */
const stringConsumed = state => ({ kind: 'consumed', state })

/**
 * A raw LF or CR **ends the literal**, wherever inside one it appears, and is
 * re-dispatched rather than consumed — so `"a<LF>1` reports the bad string and
 * still emits `number 1`. An unterminated string should not eat the rest of
 * the file, and today's tokenizer already draws the line here. A raw space
 * does *not* end it: a space is legal inside a JSON string and a newline is
 * not, so `"a 1` stays one error.
 *
 * @type {(c: U16) => boolean}
 */
const endsLiteral = c => c === lf || c === cr

/**
 * The code unit four hexadecimal digit *values* denote. The state carries the
 * values rather than the characters so this fold is total: every entry was
 * decoded by `hexDigitValue` before being stored, leaving no failure case to
 * write a branch for.
 *
 * @type {(digits: readonly number[]) => number}
 */
const hexCodeUnit = digits => digits.reduce((a, d) => a * 16 + d, 0)

/** How many hexadecimal digits a `\u` escape takes. */
const hexDigitCount = 4

/**
 * Scans one JSON string literal, consuming its own opening `"`.
 *
 * A malformed literal runs to its next **unescaped** quote, which it consumes,
 * or to a raw LF, CR or end of input, which it does not. The general
 * terminator rule cannot apply inside a literal, where the only structure is
 * the quote: re-dispatching the closing `"` of `"\x"` would start a *second*
 * string that then hit end of input, giving two errors where one is owed.
 *
 * Unlike `scanNumber`'s, this recovery consumes — it ends at string syntax
 * rather than at delimiters, and DataJS's strings are JSON's unchanged, so
 * there is no policy here for a caller to disagree with.
 *
 * @type {Scan<StringState>}
 */
export const scanString = state => input => {
    // `done` and `failed` are terminal, so a caller that keeps feeding them
    // gets a stable answer rather than an error.
    if (state.kind === 'done' || state.kind === 'failed') { return stringStopped(state) }
    // An unterminated literal at end of input has failed; the caller emits one
    // error and re-dispatches the end.
    if (input === null) {
        return stringStopped(state.kind === 'start' ? state : { kind: 'failed' })
    }
    const c = input
    switch (state.kind) {
        case 'start': return c === quotationMark
            ? stringConsumed({ kind: 'body', value: '' })
            : stringStopped(state)
        case 'body': return endsLiteral(c) ? stringStopped({ kind: 'failed' })
            : c === quotationMark ? stringConsumed({ kind: 'done', value: state.value })
                : c === reverseSolidus ? stringConsumed({ kind: 'escape', value: state.value })
                    // Every other C0 control character is rejected too, but the
                    // literal continues to its closing quote — which is why the
                    // rule keys on which control character it is.
                    : c < firstNonControl ? stringConsumed({ kind: 'recovery' })
                        : stringConsumed({ kind: 'body', value: `${state.value}${fromCharCode(c)}` })
        case 'escape': {
            if (endsLiteral(c)) { return stringStopped({ kind: 'failed' }) }
            if (c === latinSmallLetterU) { return stringConsumed({ kind: 'hex', value: state.value, digits: [] }) }
            const escaped = escapeToCodePoint(c)
            return escaped === null
                ? stringConsumed({ kind: 'recovery' })
                : stringConsumed({ kind: 'body', value: `${state.value}${fromCharCode(escaped)}` })
        }
        case 'hex': {
            if (endsLiteral(c)) { return stringStopped({ kind: 'failed' }) }
            const value = hexDigitValue(c)
            if (value === null) { return stringConsumed({ kind: 'recovery' }) }
            const digits = [...state.digits, value]
            return stringConsumed(digits.length === hexDigitCount
                ? { kind: 'body', value: `${state.value}${fromCharCode(hexCodeUnit(digits))}` }
                : { kind: 'hex', value: state.value, digits })
        }
        case 'recovery': return endsLiteral(c) ? stringStopped({ kind: 'failed' })
            : c === quotationMark ? stringConsumed({ kind: 'failed' })
                : c === reverseSolidus ? stringConsumed({ kind: 'recoveryEscape' })
                    : stringConsumed(state)
        // Recovery keeps interpreting backslashes, so the quote in `"\x\""` is
        // the second half of an escape and only the final quote closes the
        // literal. One `recovery` variant could not answer that.
        default: return endsLiteral(c)
            ? stringStopped({ kind: 'failed' })
            : stringConsumed({ kind: 'recovery' })
    }
}

/** The initial state of a string scan: the opening `"` not yet consumed. */
export const stringStart = /** @type {StringState} */({ kind: 'start' })

/** @type {(message: JsonErrorMessage) => List<JsonToken>} */
const errorToken = message => [{ kind: 'error', message }]

/** @type {_TokenizerState} */
const top = { kind: 'top' }

/**
 * The keyword a word run spells, or one error.
 *
 * A word is a maximal run, and it is a keyword only if the whole run is one:
 * `true0`, `nullx` and `tru3` are each one `invalid token`, where a prefix
 * matcher would emit the keyword and then something else.
 *
 * @type {(lexeme: string) => List<JsonToken>}
 */
const wordToken = lexeme => {
    switch (lexeme) {
        case 'true': return [{ kind: 'true' }]
        case 'false': return [{ kind: 'false' }]
        case 'null': return [{ kind: 'null' }]
        default: return errorToken('invalid token')
    }
}

/** @type {(c: U16) => (JsonToken & { readonly kind: '{' | '}' | '[' | ']' | ':' | ',' }) | null} */
const structuralToken = c => {
    switch (c) {
        case leftCurlyBracket: return { kind: '{' }
        case rightCurlyBracket: return { kind: '}' }
        case leftSquareBracket: return { kind: '[' }
        case rightSquareBracket: return { kind: ']' }
        case colon: return { kind: ':' }
        case comma: return { kind: ',' }
        default: return null
    }
}

/** @type {(c: U16) => boolean} */
const isWhitespace = c => c === space || c === ht || c === lf || c === cr

/**
 * Top-level dispatch: which lexeme, if any, this character starts.
 *
 * Both scanners consume their own opening character, so it is fed to them
 * rather than stepped past.
 *
 * @type {(c: U16 | null) => readonly [List<JsonToken>, _TokenizerState]}
 */
const stepTop = c => {
    if (c === null) { return [[{ kind: 'eof' }], top] }
    if (isWhitespace(c)) { return [empty, top] }
    if (c === quotationMark) {
        return [empty, { kind: 'string', string: scanString(stringStart)(c).state }]
    }
    if (c === hyphenMinus || isDigit(c)) {
        return [empty, { kind: 'number', number: scanNumber(numberStart)(c).state }]
    }
    if (isWordStart(c)) { return [empty, { kind: 'word', lexeme: fromCharCode(c) }] }
    const t = structuralToken(c)
    return t === null ? [errorToken('unexpected character'), top] : [[t], top]
}

/**
 * Emit `tokens`, then hand the character that ended the lexeme back to
 * top-level dispatch.
 *
 * Re-dispatch is what keeps `1e"a"` emitting the string and `null-1` emitting
 * the number. It only ever goes to `top`, and `top` re-dispatches nothing, so
 * there is no recursion here.
 *
 * @type {(tokens: List<JsonToken>, c: U16 | null) => readonly [List<JsonToken>, _TokenizerState]}
 */
const redispatch = (tokens, c) => {
    const [more, next] = stepTop(c)
    return [concat(tokens)(more), next]
}

/**
 * The step function `stateScan` folds: one character against the lexeme the
 * tokenizer is in the middle of.
 *
 * @type {(c: U16 | null, state: _TokenizerState) => readonly [List<JsonToken>, _TokenizerState]}
 */
const step = (c, state) => {
    switch (state.kind) {
        case 'top': return stepTop(c)
        case 'string': {
            const r = scanString(state.string)(c)
            const next = r.state
            // `done` is only ever entered by *consuming* the closing quote, so
            // there is no character left to re-dispatch — unlike `failed`,
            // which a raw LF, CR or end of input reaches without consuming.
            if (next.kind === 'done') {
                return [[{ kind: 'string', value: next.value }], top]
            }
            if (next.kind === 'failed') {
                const token = errorToken('invalid string')
                return r.kind === 'consumed' ? [token, top] : redispatch(token, c)
            }
            return [empty, { kind: 'string', string: next }]
        }
        case 'number': {
            const r = scanNumber(state.number)(c)
            if (r.kind === 'consumed') {
                return r.state.kind === 'recovery'
                    ? [empty, { kind: 'numberRecovery' }]
                    : [empty, { kind: 'number', number: r.state }]
            }
            // An accepting stop at one of JSON's terminators is a number; every
            // other stop — accepting at a non-terminator like the `"` in
            // `12"a"`, or incomplete like `1e` — is one error. The character is
            // re-dispatched either way, which is what stops a malformed number
            // from swallowing the token after it.
            return redispatch(
                numberAccepts.has(state.number.kind) && isNumberTerminator(c)
                    ? [{ kind: 'number', value: state.number.lexeme }]
                    : errorToken('invalid number'),
                c)
        }
        // Recovery is the tokenizer's because the boundary set is: `scanNumber`
        // reported that it absorbed a character and stopped, and JSON runs to
        // its own boundary from there.
        case 'numberRecovery': return isRecoveryBoundary(c)
            ? redispatch(errorToken('invalid number'), c)
            : [empty, state]
        default: return c !== null && isWordChar(c)
            ? [empty, { kind: 'word', lexeme: `${state.lexeme}${fromCharCode(c)}` }]
            : redispatch(wordToken(state.lexeme), c)
    }
}

/**
 * Converts a list of UTF-16 code units into JSON tokens.
 *
 * Every lexeme that cannot be completed produces exactly one
 * `{ kind: 'error' }` and no value token, so a caller that filters errors out
 * — or a parser that resynchronizes on the next value — never sees a value the
 * document did not contain.
 *
 * @type {(input: List<number>) => List<JsonToken>}
 */
export const tokenize = input =>
    flat(stateScan(step)(top)(concat(/** @type {List<U16 | null>} */(input))([null])))
