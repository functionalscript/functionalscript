/**
 * @import { JsonToken, NumberState, StringState } from './types.ts'
 */

import { scanNumber, scanString, numberStart, stringStart, tokenize } from './module.f.mjs'
import { expected, inputs, recorded, streams } from './sweep.f.mjs'
import { toArray } from '../../../types/list/module.f.mjs'
import { stringifyAsTree } from '../../../djs/serializer/module.f.mjs'
import { sort } from '../../../types/object/module.f.mjs'
import { stringToList } from '../../../text/utf16/module.f.mjs'
import { assert, assertEq, assertStructurallySame } from '../../../asserts/module.f.mjs'

/** @type {(s: string) => readonly JsonToken[]} */
const tokenizeString = s => toArray(tokenize(stringToList(s)))

const stringify = stringifyAsTree(sort)

/** One line per token stream, matching the sweep tables' rendering. */
const render = /** @type {(s: string) => string} */(s => tokenizeString(s).map(t =>
    t.kind === 'error' ? `E(${t.message})`
        : 'value' in t ? `${t.kind}(${JSON.stringify(t.value)})`
            : t.kind).join(' '))

/**
 * Feeds `s` to `scanNumber` from `numberStart` and reports where it stopped:
 * the state it was in and the index of the character it did not consume.
 *
 * This is a *caller*, written the way `fjs/media/datajs` will write one — the
 * scanner applies no terminator policy of its own, so a driver has to.
 *
 * @type {(s: string) => readonly [NumberState, number]}
 */
const runNumber = s => {
    /** @type {(state: NumberState, i: number) => readonly [NumberState, number]} */
    const go = (state, i) => {
        if (i === s.length) { return [state, i] }
        const r = scanNumber(state)(s.charCodeAt(i))
        return r.kind === 'consumed' ? go(r.state, i + 1) : [state, i]
    }
    return go(numberStart, 0)
}

/** @type {(s: string) => readonly [StringState, number]} */
const runString = s => {
    /** @type {(state: StringState, i: number) => readonly [StringState, number]} */
    const go = (state, i) => {
        if (i === s.length) { return [state, i] }
        const r = scanString(state)(s.charCodeAt(i))
        return r.kind === 'consumed' ? go(r.state, i + 1) : [state, i]
    }
    return go(stringStart, 0)
}

export const proof = {
    // Accepted-input cases. Every one of these passes **byte-identically** to
    // the wrapper this replaces, which is invariant 1 and the property every
    // consumer depends on. A failure among them is a defect in the port.
    json: [
        () => assertEq(stringify(tokenizeString('')), '[{"kind":"eof"}]'),
        () => assertEq(stringify(tokenizeString('{')), '[{"kind":"{"},{"kind":"eof"}]'),
        () => assertEq(stringify(tokenizeString('}')), '[{"kind":"}"},{"kind":"eof"}]'),
        () => assertEq(stringify(tokenizeString(':')), '[{"kind":":"},{"kind":"eof"}]'),
        () => assertEq(stringify(tokenizeString(',')), '[{"kind":","},{"kind":"eof"}]'),
        () => assertEq(stringify(tokenizeString('[')), '[{"kind":"["},{"kind":"eof"}]'),
        () => assertEq(stringify(tokenizeString(']')), '[{"kind":"]"},{"kind":"eof"}]'),
        () => assertEq(stringify(tokenizeString('ᄑ')), '[{"kind":"error","message":"unexpected character"},{"kind":"eof"}]'),
        () => assertEq(stringify(tokenizeString('{ \t\n\r}')), '[{"kind":"{"},{"kind":"}"},{"kind":"eof"}]'),
        () => assertEq(stringify(tokenizeString('""')), '[{"kind":"string","value":""},{"kind":"eof"}]'),
        () => assertEq(stringify(tokenizeString('"value"')), '[{"kind":"string","value":"value"},{"kind":"eof"}]'),
        () => assertEq(stringify(tokenizeString('"value1" "value2"')), '[{"kind":"string","value":"value1"},{"kind":"string","value":"value2"},{"kind":"eof"}]'),
        () => assertEq(stringify(tokenizeString('"\\\\"')), '[{"kind":"string","value":"\\\\"},{"kind":"eof"}]'),
        () => assertEq(stringify(tokenizeString('"\\""')), '[{"kind":"string","value":"\\""},{"kind":"eof"}]'),
        () => assertEq(stringify(tokenizeString('"\\/"')), '[{"kind":"string","value":"/"},{"kind":"eof"}]'),
        () => assertEq(stringify(tokenizeString('"\\b\\f\\n\\r\\t"')), '[{"kind":"string","value":"\\b\\f\\n\\r\\t"},{"kind":"eof"}]'),
        () => assertEq(stringify(tokenizeString('"\\u1234"')), '[{"kind":"string","value":"ሴ"},{"kind":"eof"}]'),
        () => assertEq(stringify(tokenizeString('"\\uaBcDEeFf"')), '[{"kind":"string","value":"ꯍEeFf"},{"kind":"eof"}]'),
        () => assertEq(stringify(tokenizeString('0')), '[{"kind":"number","value":"0"},{"kind":"eof"}]'),
        () => assertEq(stringify(tokenizeString('[0]')), '[{"kind":"["},{"kind":"number","value":"0"},{"kind":"]"},{"kind":"eof"}]'),
        () => assertEq(stringify(tokenizeString('00')), '[{"kind":"error","message":"invalid number"},{"kind":"eof"}]'),
        () => assertEq(stringify(tokenizeString('0abc,')), '[{"kind":"error","message":"invalid number"},{"kind":"error","message":"invalid token"},{"kind":","},{"kind":"eof"}]'),
        () => assertEq(stringify(tokenizeString('123456789012345678901234567890')), '[{"kind":"number","value":"123456789012345678901234567890"},{"kind":"eof"}]'),
        () => assertEq(stringify(tokenizeString('{90}')), '[{"kind":"{"},{"kind":"number","value":"90"},{"kind":"}"},{"kind":"eof"}]'),
        () => assertEq(stringify(tokenizeString('1 2')), '[{"kind":"number","value":"1"},{"kind":"number","value":"2"},{"kind":"eof"}]'),
        () => assertEq(stringify(tokenizeString('0. 2')), '[{"kind":"error","message":"invalid number"},{"kind":"number","value":"2"},{"kind":"eof"}]'),
        () => assertEq(stringify(tokenizeString('10-0')), '[{"kind":"number","value":"10"},{"kind":"number","value":"-0"},{"kind":"eof"}]'),
        () => assertEq(stringify(tokenizeString('9a:')), '[{"kind":"error","message":"invalid number"},{"kind":"error","message":"invalid token"},{"kind":":"},{"kind":"eof"}]'),
        () => assertEq(stringify(tokenizeString('-10')), '[{"kind":"number","value":"-10"},{"kind":"eof"}]'),
        () => assertEq(stringify(tokenizeString('-0')), '[{"kind":"number","value":"-0"},{"kind":"eof"}]'),
        () => assertEq(stringify(tokenizeString('0.01')), '[{"kind":"number","value":"0.01"},{"kind":"eof"}]'),
        () => assertEq(stringify(tokenizeString('-0.9')), '[{"kind":"number","value":"-0.9"},{"kind":"eof"}]'),
        () => assertEq(stringify(tokenizeString('12.34')), '[{"kind":"number","value":"12.34"},{"kind":"eof"}]'),
        () => assertEq(stringify(tokenizeString('-12.00')), '[{"kind":"number","value":"-12.00"},{"kind":"eof"}]'),
        () => assertEq(stringify(tokenizeString('0e1')), '[{"kind":"number","value":"0e1"},{"kind":"eof"}]'),
        () => assertEq(stringify(tokenizeString('0e+2')), '[{"kind":"number","value":"0e+2"},{"kind":"eof"}]'),
        () => assertEq(stringify(tokenizeString('0e-0')), '[{"kind":"number","value":"0e-0"},{"kind":"eof"}]'),
        () => assertEq(stringify(tokenizeString('12e0000')), '[{"kind":"number","value":"12e0000"},{"kind":"eof"}]'),
        () => assertEq(stringify(tokenizeString('-12e-0001')), '[{"kind":"number","value":"-12e-0001"},{"kind":"eof"}]'),
        () => assertEq(stringify(tokenizeString('-12.34e1234')), '[{"kind":"number","value":"-12.34e1234"},{"kind":"eof"}]'),
        () => assertEq(stringify(tokenizeString('0e')), '[{"kind":"error","message":"invalid number"},{"kind":"eof"}]'),
        () => assertEq(stringify(tokenizeString('0e-')), '[{"kind":"error","message":"invalid number"},{"kind":"eof"}]'),
        () => assertEq(stringify(tokenizeString('err')), '[{"kind":"error","message":"invalid token"},{"kind":"eof"}]'),
        () => assertEq(stringify(tokenizeString('{e}')), '[{"kind":"{"},{"kind":"error","message":"invalid token"},{"kind":"}"},{"kind":"eof"}]'),
        () => assertEq(stringify(tokenizeString('tru')), '[{"kind":"error","message":"invalid token"},{"kind":"eof"}]'),
        () => assertEq(stringify(tokenizeString('break')), '[{"kind":"error","message":"invalid token"},{"kind":"eof"}]'),
        () => assertEq(stringify(tokenizeString('true')), '[{"kind":"true"},{"kind":"eof"}]'),
        () => assertEq(stringify(tokenizeString('false')), '[{"kind":"false"},{"kind":"eof"}]'),
        () => assertEq(stringify(tokenizeString('null')), '[{"kind":"null"},{"kind":"eof"}]'),
        () => assertEq(stringify(tokenizeString('[null]')), '[{"kind":"["},{"kind":"null"},{"kind":"]"},{"kind":"eof"}]'),
    ],
    // The error-shape cases the port rewrites, each with the reason it changed.
    // Every one of these errored before and errors now — invariant 2 — so what
    // moved is the message or the count, never whether the input is accepted.
    changedShapes: {
        // `" are missing` and `unterminated string literal` were two messages
        // for one condition, and both were the JavaScript tokenizer's.
        unterminatedAtEof: () => assertEq(
            stringify(tokenizeString('"value')),
            '[{"kind":"error","message":"invalid string"},{"kind":"eof"}]'),
        bareQuote: () => assertEq(
            stringify(tokenizeString('"')),
            '[{"kind":"error","message":"invalid string"},{"kind":"eof"}]'),
        trailingBackslash: () => assertEq(
            stringify(tokenizeString('"\\')),
            '[{"kind":"error","message":"invalid string"},{"kind":"eof"}]'),
        // A lone `-` was `invalid token` because the JS tokenizer had already
        // lexed it as an operator. It is a number that never started.
        loneMinus: () => assertEq(
            stringify(tokenizeString('-')),
            '[{"kind":"error","message":"invalid number"},{"kind":"eof"}]'),
        // `--` reported *once* and `---` twice, because JavaScript merges the
        // first two into a decrement operator. The count now follows the input.
        twoMinuses: () => assertEq(
            stringify(tokenizeString('--')),
            '[{"kind":"error","message":"invalid number"},{"kind":"error","message":"invalid number"},{"kind":"eof"}]'),
        threeMinuses: () => assertEq(
            stringify(tokenizeString('---')),
            '[{"kind":"error","message":"invalid number"},{"kind":"error","message":"invalid number"},{"kind":"error","message":"invalid number"},{"kind":"eof"}]'),
        // One malformed number, one error. The second error was the `'-'`
        // state's, a JavaScript artifact: the same input without a sign
        // reported once.
        signedLeadingZero: () => assertEq(
            stringify(tokenizeString('-00')),
            '[{"kind":"error","message":"invalid number"},{"kind":"eof"}]'),
        signedTrailingPoint: () => assertEq(
            stringify(tokenizeString('-0.')),
            '[{"kind":"error","message":"invalid number"},{"kind":"eof"}]'),
        signedTrailingPointThenBracket: () => assertEq(
            stringify(tokenizeString('-0.]')),
            '[{"kind":"error","message":"invalid number"},{"kind":"]"},{"kind":"eof"}]'),
        signedTrailingPointTwoDigits: () => assertEq(
            stringify(tokenizeString('-12.')),
            '[{"kind":"error","message":"invalid number"},{"kind":"eof"}]'),
        // Same count as before; the messages become JSON's. The `-` is an
        // incomplete stop, so the `.` is re-dispatched and `123` survives.
        minusPoint: () => assertEq(
            stringify(tokenizeString('-.123')),
            '[{"kind":"error","message":"invalid number"},{"kind":"error","message":"unexpected character"},{"kind":"number","value":"123"},{"kind":"eof"}]'),
        // `0n` was a single `invalid token` because it is a valid **JavaScript
        // bigint literal**, mapped wholesale — the coupling this port removes,
        // visible in the output.
        bigintLiteral: () => assertEq(
            stringify(tokenizeString('0n')),
            '[{"kind":"error","message":"invalid number"},{"kind":"error","message":"invalid token"},{"kind":"eof"}]'),
        longBigintLiteral: () => assertEq(
            stringify(tokenizeString('1234567890n')),
            '[{"kind":"error","message":"invalid number"},{"kind":"error","message":"invalid token"},{"kind":"eof"}]'),
        bigintInArray: () => assertEq(
            stringify(tokenizeString('[-1234567890n]')),
            '[{"kind":"["},{"kind":"error","message":"invalid number"},{"kind":"error","message":"invalid token"},{"kind":"]"},{"kind":"eof"}]'),
        // The one deliberate change to the accepted language: the old
        // tokenizer *deleted* the `n` and returned `number 11`, answering
        // malformed input with a plausible wrong value.
        nInsideANumber: () => assertEq(
            stringify(tokenizeString('1n1')),
            '[{"kind":"error","message":"invalid number"},{"kind":"error","message":"invalid token"},{"kind":"eof"}]'),
        nInsideAZero: () => assertEq(
            stringify(tokenizeString('0n1')),
            '[{"kind":"error","message":"invalid number"},{"kind":"error","message":"invalid token"},{"kind":"eof"}]'),
        twoNsInsideANumber: () => assertEq(
            stringify(tokenizeString('1n1n1')),
            '[{"kind":"error","message":"invalid number"},{"kind":"error","message":"invalid token"},{"kind":"eof"}]'),
        // A JavaScript operator run was one token; JSON reads it one character
        // at a time, because it has no such construct to be maximal about.
        operatorRun: () => assertEq(render('>>>='), 'E(unexpected character) E(unexpected character) E(unexpected character) E(unexpected character) eof'),
    },
    // A malformed string literal is reported as errors alone: no value token
    // for text no document contained. Stage 3a established the rule against the
    // wrapper; the scanner makes it structural, since `recovery` has nowhere to
    // put a value.
    stringRecovery: {
        invalidEscape: () => assertEq(render('"\\x"'), 'E(invalid string) eof'),
        // a second escape, so the proof holds the class and not one instance
        // of it: `\v` is a JavaScript escape that JSON does not have
        escapeJsHasAndJsonDoesNot: () => assertEq(render('"\\v"'), 'E(invalid string) eof'),
        invalidHexValue: () => assertEq(render('"\\uEeFg"'), 'E(invalid string) eof'),
        // JavaScript's code-point escape, which JSON does not have
        codePointEscape: () => assertEq(render('"\\u{41}"'), 'E(invalid string) eof'),
        // a raw control character, which the literal absorbs and continues past
        rawTab: () => assertEq(render('"a\tb"'), 'E(invalid string) eof'),
        rawNul: () => assertEq(render('"\u0000"'), 'E(invalid string) eof'),
        // two defects in one literal are now one error, because recovery runs
        // to the end of the literal rather than reporting each escape
        twoInvalidEscapes: () => assertEq(render('"\\x\\y"'), 'E(invalid string) eof'),
        // a genuine string after the error still arrives
        laterStringSurvives: () => assertEq(render('"\\x" "ok"'), 'E(invalid string) string("ok") eof'),
        // the fabricated token also reached the wrapper's `'-'` state; there is
        // no such state now, and `-` is a number that never started
        afterMinus: () => assertEq(render('-"\\x"'), 'E(invalid number) E(invalid string) eof'),
        // Recovery keeps interpreting backslashes: the quote after `\x` is the
        // second half of a `\"` escape, and only the final quote closes the
        // literal. Stopping at the first would give two errors.
        escapedQuoteInRecovery: () => assertEq(render('"\\x\\""'), 'E(invalid string) eof'),
        // pins the resumption point, not just the count
        resumptionAfterRecovery: () => assertEq(
            render('"ok\\x\\"tail" 1'),
            'E(invalid string) number("1") eof'),
        // Where recovery ends: a raw LF and a raw CR end the literal and are
        // re-dispatched, so the number after them survives — an unterminated
        // string does not eat the rest of the file.
        rawNewLineEndsRecovery: () => assertEq(render('"a\n1'), 'E(invalid string) number("1") eof'),
        rawCarriageReturnEndsRecovery: () => assertEq(render('"a\r1'), 'E(invalid string) number("1") eof'),
        // ...but a raw space does not: a space is legal inside a JSON string.
        rawSpaceDoesNot: () => assertEq(render('"a 1'), 'E(invalid string) eof'),
        // a lone surrogate is a code unit JSON permits and no code point can
        // represent, which is why the scanner never decodes past the escape
        loneSurrogate: () => assertStructurallySame(
            tokenizeString('"\\ud800"'),
            [{ kind: 'string', value: '\ud800' }, { kind: 'eof' }]),
        // the same string, spelled raw and escaped, decodes to the same units
        astralSpellingsAgree: () => assertEq(
            render('"😀"'),
            render('"\\ud83d\\ude00"')),
    },
    // A word is a **maximal** run of `[A-Za-z0-9_$]`, and a keyword only if the
    // whole run is one. A prefix matcher fits the grammar just as well and
    // would silently change the token stream, so the rule is pinned.
    words: {
        keywordThenDigit: () => assertEq(render('true0'), 'E(invalid token) eof'),
        keywordThenLowLine: () => assertEq(render('true_'), 'E(invalid token) eof'),
        keywordThenDollar: () => assertEq(render('true$'), 'E(invalid token) eof'),
        keywordThenLetter: () => assertEq(render('nullx'), 'E(invalid token) eof'),
        keywordsRunTogether: () => assertEq(render('truefalse'), 'E(invalid token) eof'),
        digitInsideAWord: () => assertEq(render('tru3'), 'E(invalid token) eof'),
        lowLineStartsAWord: () => assertEq(render('_x'), 'E(invalid token) eof'),
        dollarStartsAWord: () => assertEq(render('$x'), 'E(invalid token) eof'),
        // `-` is not a word character, so the number after `null` is its own
        minusEndsAWord: () => assertEq(render('null-1'), 'null number("-1") eof'),
        // and a character outside the word set is `unexpected character`
        nonWordCharacterEndsAWord: () => assertEq(render('trueÿ'), 'true E(unexpected character) eof'),
        bracketEndsAWord: () => assertEq(render('true]'), 'true ] eof'),
        spaceEndsAWord: () => assertEq(render('true true'), 'true true eof'),
        // a digit starts a *number*, so this is two lexemes where `tru3` is one
        digitStartsANumber: () => assertEq(render('0abc'), 'E(invalid number) E(invalid token) eof'),
    },
    // Recovery is reproduced exactly rather than improved, which is what the
    // `00` family is for: **no input here changes its token kinds or counts**.
    numberRecovery: {
        // Unchanged token for token, messages included.
        minusIsNotABoundary: () => assertEq(render('00-2'), 'E(invalid number) eof'),
        trailingMinus: () => assertEq(render('00-'), 'E(invalid number) eof'),
        quoteIsNotABoundary: () => assertEq(render('00"a"'), 'E(invalid number) eof'),
        semicolonIsABoundary: () => assertEq(render('00;1'), 'E(invalid number) E(unexpected character) number("1") eof'),
        spaceIsABoundary: () => assertEq(render('00 1'), 'E(invalid number) number("1") eof'),
        bracketIsABoundary: () => assertEq(render('00]'), 'E(invalid number) ] eof'),
        commaIsABoundary: () => assertEq(render('00,'), 'E(invalid number) , eof'),
        newLineIsABoundary: () => assertEq(render('00\n1'), 'E(invalid number) number("1") eof'),
        // Kinds and counts kept; `/`'s message becomes `unexpected character`
        // because it was `invalid token` only as a JavaScript operator.
        solidusBoundary: () => assertEq(render('00/1'), 'E(invalid number) E(unexpected character) number("1") eof'),
        solidusAfterQuote: () => assertEq(render('00"/1'), 'E(invalid number) E(unexpected character) number("1") eof'),
        solidusAfterMinusQuote: () => assertEq(render('00-"/1'), 'E(invalid number) E(unexpected character) number("1") eof'),
        completeNumberThenSolidus: () => assertEq(render('12/1'), 'number("12") E(unexpected character) number("1") eof'),
        // Absorption: the only way into recovery. One error, rest swallowed.
        plusAbsorbed: () => assertEq(render('12+1'), 'E(invalid number) eof'),
        plusAbsorbedThenString: () => assertEq(render('12+"a"'), 'E(invalid number) eof'),
        // ...and the `]` survives, because the `+` was absorbed rather than
        // re-dispatched into a fresh scan that would hand `"` to a string.
        plusAbsorbedBracketSurvives: () => assertEq(render('12+"]'), 'E(invalid number) ] eof'),
        pointAfterExponentAbsorbed: () => assertEq(render('1e."a"'), 'E(invalid number) eof'),
        leadingZeroAbsorbs: () => assertEq(render('01"a"'), 'E(invalid number) eof'),
        // An **incomplete** stop re-dispatches instead, in all five phases —
        // the case a two-state rule swallowed, destroying a string each time.
        incompleteAfterSign: () => assertEq(render('-"a"'), 'E(invalid number) string("a") eof'),
        incompleteAfterPoint: () => assertEq(render('1."a"'), 'E(invalid number) string("a") eof'),
        incompleteAfterExponent: () => assertEq(render('1e"a"'), 'E(invalid number) string("a") eof'),
        incompleteAfterExponentPlus: () => assertEq(render('1e+"a"'), 'E(invalid number) string("a") eof'),
        incompleteAfterExponentMinus: () => assertEq(render('1e-"a"'), 'E(invalid number) string("a") eof'),
        // An **accepting** stop at a non-terminator does the same.
        acceptingStopAtQuote: () => assertEq(render('12"a"'), 'E(invalid number) string("a") eof'),
        acceptingStopAtWord: () => assertEq(render('1true'), 'E(invalid number) true eof'),
        // The pair most easily conflated: `0` completes and re-dispatches,
        // while `00` absorbed its second digit and recovers.
        acceptingStopVersusAbsorption: () => {
            assertEq(render('0abc'), 'E(invalid number) E(invalid token) eof')
            assertEq(render('00abc'), 'E(invalid number) eof')
        },
    },
    // The one place a suffix token is lost, asserted rather than left to be
    // discovered. A JavaScript comment is a construct JSON's scanner has no
    // state for, and giving it one would mean teaching JSON the *extent* of a
    // JavaScript construct — the grammar this port exists to remove.
    //
    // Every consumer of `tokenize` in this repository hands the tokens to
    // `parse`, which returns the same error for `/*"*/1` either way, so the
    // lost suffix is unobservable through every path that exists.
    comments: {
        blockCommentWithWord: () => assertEq(
            render('/*a*/1'),
            'E(unexpected character) E(unexpected character) E(invalid token) E(unexpected character) E(unexpected character) number("1") eof'),
        // the loss: the `"` inside the comment starts a JSON string that runs
        // to end of input and eats `*/1`
        blockCommentWithQuote: () => assertEq(
            render('/*"*/1'),
            'E(unexpected character) E(unexpected character) E(invalid string) eof'),
        // a line comment cannot swallow a suffix: the LF ends string recovery
        // and is re-dispatched, so the construct and the literal end together
        lineCommentKeepsItsSuffix: () => assertEq(
            render('//"\n1'),
            'E(unexpected character) E(unexpected character) E(invalid string) number("1") eof'),
    },
    // Losslessness starts at the tokenizer boundary: a syntactically valid
    // JSON number reaches `NumberToken.value` as its exact lexeme. Nothing
    // derived from it — a coefficient bigint, an exponent number — is built
    // while scanning, so no valid input can fail to tokenize because such a
    // derived value would exceed a runtime numeric limit.
    //
    // The runtime's own bigint limit (V8 rejects magnitudes above 2^30 bits,
    // roughly 3.2e8 decimal digits) is not exercised here: the smallest input
    // that reaches it is a JSON document of some hundreds of megabytes. These
    // cases stay far below that while still being far above what `number` and
    // `Number.MAX_SAFE_INTEGER` can hold.
    lossless: {
        // a coefficient with more digits than any JavaScript number can carry
        oversizedCoefficient: () => {
            const value = `1${'0'.repeat(100000)}1`
            assertStructurallySame(
                tokenizeString(value),
                [{ kind: 'number', value }, { kind: 'eof' }])
        },
        // exponent text far beyond JavaScript-number precision: `Number` of it
        // is `Infinity`, yet every digit still has to reach the token
        unboundedExponent: () => {
            const value = '1e999999999999999999999'
            assertStructurallySame(
                tokenizeString(value),
                [{ kind: 'number', value }, { kind: 'eof' }])
        },
        negativeUnboundedExponent: () => {
            const value = '-1.5e-999999999999999999999'
            assertStructurallySame(
                tokenizeString(value),
                [{ kind: 'number', value }, { kind: 'eof' }])
        },
        negativeOversized: () => {
            const value = `-1${'0'.repeat(100000)}1`
            assertStructurallySame(
                tokenizeString(value),
                [{ kind: 'number', value }, { kind: 'eof' }])
        },
    },
    // The exported seam, proved on the scanners directly rather than through
    // `tokenize`. A seam proved only via its own module's entry point is not
    // proved as a seam, and `fjs/media/datajs` is about to be its second
    // caller.
    seam: {
        // The initial states are part of the contract, values included: a
        // wrapper that cannot name `start` cannot tell an untouched scan from
        // an interception site.
        numberStartIsStart: () => assertStructurallySame(numberStart, { kind: 'start', lexeme: '' }),
        stringStartIsStart: () => assertStructurallySame(stringStart, { kind: 'start' }),
        // A scan emits no token. It advances a state; building a token from it
        // is the caller's, which is what lets JSON build one and DataJS build a
        // different one from the same scan.
        aScanEmitsNoToken: () => {
            const r = scanNumber(numberStart)(0x31)
            assertStructurallySame(Object.keys(r).sort(), ['kind', 'state'])
        },
        // A `stopped` does not consume: the state comes back untouched, so the
        // caller still holds the character and may terminate, re-dispatch or
        // take over.
        stoppedConsumesNothing: () => {
            const [state, i] = runNumber('12"')
            assertEq(state.kind, 'int')
            assertEq(state.lexeme, '12')
            assertEq(i, 2)
            // feeding the same character again changes nothing
            const again = scanNumber(state)(0x22)
            assertEq(again.kind, 'stopped')
            assertStructurallySame(again.state, state)
        },
        // `recovery` is terminal for the number scanner, because recovery ends
        // at a boundary and the boundary set is the caller's.
        numberRecoveryIsTerminal: () => {
            const [state] = runNumber('00')
            assertEq(state.kind, 'recovery')
            for (const c of ['1', ' ', ';', '"', 'n']) {
                const r = scanNumber(state)(c.charCodeAt(0))
                assertEq(r.kind, 'stopped')
                assertStructurallySame(r.state, state)
            }
            assertEq(scanNumber(state)(null).kind, 'stopped')
        },
        // `done` and `failed` are terminal too, so a caller that keeps feeding
        // them gets a stable answer rather than an error.
        stringDoneIsTerminal: () => {
            const [state] = runString('"ab"')
            assertEq(state.kind, 'done')
            for (const c of ['x', '"', '\\', '\n']) {
                const r = scanString(state)(c.charCodeAt(0))
                assertEq(r.kind, 'stopped')
                assertStructurallySame(r.state, state)
            }
            assertEq(scanString(state)(null).kind, 'stopped')
        },
        stringFailedIsTerminal: () => {
            const [state] = runString('"\\x"')
            assertEq(state.kind, 'failed')
            for (const c of ['x', '"', '\\', '\n']) {
                const r = scanString(state)(c.charCodeAt(0))
                assertEq(r.kind, 'stopped')
                assertStructurallySame(r.state, state)
            }
        },
        // A well-formed string reaches `done` by **consuming** its closing
        // quote, so the `stopped` comes on the character after it.
        doneConsumesTheClosingQuote: () => {
            const [state, i] = runString('"ab"')
            assertEq(state.kind, 'done')
            assertEq(i, 4)
        },
        // A number's `lexeme` is its exact source text...
        numberLexemeIsSourceText: () => {
            const [state] = runNumber('-12.50e+03')
            assertEq(state.kind, 'expDigits')
            assertEq(state.lexeme, '-12.50e+03')
        },
        // ...while a string's `value` is decoded.
        stringValueIsDecoded: () => {
            const [state] = runString('"a\\tb\\u0041"')
            assertEq(state.kind, 'done')
            assertEq(state.kind === 'done' ? state.value : '', 'a\tbA')
        },
        // The terminator set is the **caller's**. A DataJS-shaped caller whose
        // set contains `;` gets `number 1` from `1;`, which is what
        // `const $0=1;` and `export default 1;` need — and the scanner needed
        // no parameter to provide it.
        terminatorPolicyIsTheCallers: () => {
            const [state, i] = runNumber('1;')
            assertEq(state.kind, 'int')
            assertEq(state.lexeme, '1')
            assertEq(i, 1)
            // the caller decides; this one accepts `;`
            const dataJsAccepts = new Set([';', ',', ']', '}', ' '])
            assert(dataJsAccepts.has(';'))
            assert(['int', 'frac', 'expDigits'].includes(state.kind))
        },
        // The scanners consume their own opening character, so there is no
        // "already consumed" ambiguity for a caller to get wrong.
        scannersConsumeTheirOpener: () => {
            assertEq(scanNumber(numberStart)(0x2d).kind, 'consumed')
            assertEq(scanString(stringStart)(0x22).kind, 'consumed')
            // and refuse anything else, without consuming it
            assertEq(scanNumber(numberStart)(0x61).kind, 'stopped')
            assertEq(scanString(stringStart)(0x61).kind, 'stopped')
            assertEq(scanNumber(numberStart)(null).kind, 'stopped')
            assertEq(scanString(stringStart)(null).kind, 'stopped')
        },
    },
    // The state is observable the way a wrapper needs: from the exported state
    // alone, before the accept-or-reject decision.
    states: {
        // The bigint interception point, reachable only by a well-formed `int`.
        stoppedAfterAWellFormedInt: () => {
            const [state, i] = runNumber('12n')
            assertEq(state.kind, 'int')
            assertEq(state.lexeme, '12')
            assertEq(i, 2)
        },
        // A single `0` is an `int` too — `0n` is as valid a bigint as `12n`,
        // which is why the leading zero is not a variant of its own.
        zeroIsAnInt: () => {
            const [state] = runNumber('0n')
            assertEq(state.kind, 'int')
            assertEq(state.lexeme, '0')
        },
        // The `-Infinity` interception point, and only it.
        stoppedAfterTheSign: () => {
            const [state, i] = runNumber('-Infinity')
            assertEq(state.kind, 'sign')
            assertEq(state.lexeme, '-')
            assertEq(i, 1)
        },
        // `start` is closed to interception: it says nothing has been read.
        // Pinned so an untouched scanner cannot pose as an interception site.
        startIsNeitherSignNorInt: () => {
            assertEq(numberStart.kind, 'start')
            assert(numberStart.kind !== 'sign')
            assert(numberStart.kind !== 'int')
            assertEq(numberStart.lexeme, '')
        },
        // The ways into `recovery`, pinned explicitly: this is the single
        // distinction standing between a wrapper and a bigint minted from
        // `00n`, `12+n` or `1e.n`, none of which JavaScript accepts.
        recoveryAfterLeadingZero: () => assertEq(runNumber('00n')[0].kind, 'recovery'),
        recoveryAfterAbsorbedPlus: () => assertEq(runNumber('12+n')[0].kind, 'recovery'),
        recoveryAfterAbsorbedPoint: () => assertEq(runNumber('1e.n')[0].kind, 'recovery'),
        // ...and every other phase is distinguishable from all of them.
        everyPhaseIsItsOwnVariant: () => assertStructurallySame(
            ['', '-', '1', '1.', '1.5', '1e', '1e+', '1e5', '00'].map(s => runNumber(s)[0].kind),
            ['start', 'sign', 'int', 'point', 'frac', 'exp', 'expSign', 'expDigits', 'recovery']),
        // The string scanner's states, reached the same way.
        everyStringStateIsReachable: () => assertStructurallySame(
            ['', '"a', '"\\', '"\\u', '"\\x', '"\\x\\', '"a"', '"\\x"'].map(s => runString(s)[0].kind),
            ['start', 'body', 'escape', 'hex', 'recovery', 'recoveryEscape', 'done', 'failed']),
    },
    // The differential sweep. `expected` is asserted; `recorded` is what the
    // wrapper produced before the port, and the two invariants are checked
    // against the pair — which is the whole point of having recorded it.
    sweep: {
        matchesTheCommittedTable: () => {
            assertEq(expected.length, inputs.length)
            for (const [i, input] of inputs.entries()) { assertEq(render(input), streams[expected[i]]) }
        },
        // Invariant 1 and 2 together: no row may move between erroring and not
        // erroring, in either direction — **except** where the old tokenizer
        // deleted an `n` from inside a number, which is this port's one
        // deliberate change to the accepted language.
        //
        // The test is on the *old* output, not on the input's shape: the class
        // includes `1n1n1` and `-1n1` but excludes `1n0`, and every attempt to
        // write that shape down has been wrong.
        crossesTheErroringBoundaryOnlyForTheNClass: () => {
            assertEq(recorded.length, inputs.length)
            const errs = /** @type {(s: string) => boolean} */(t => t.includes('E('))
            for (const [i, input] of inputs.entries()) {
                const before = streams[recorded[i]]
                const now = streams[expected[i]]
                if (errs(before) === errs(now)) { continue }
                // It crossed, so the old output must be a bare number whose
                // value is the input with its `n`s deleted. Two rows reach
                // here, `12n1` and `0n1`.
                assertEq(before, `number(${JSON.stringify(input.replaceAll('n', ''))}) eof`)
                assert(errs(now))
            }
        },
    },
}
