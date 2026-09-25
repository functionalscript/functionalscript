import { digitsValue, hexDigitCodePoint, hexDigitValue, isCanonicalDigits, lowerHexDigitValue, one, range } from './module.f.mjs'
import { stringify as jsonStringify } from '../../media/json/module.f.mjs'
import { sort } from '../../types/object/module.f.mjs'
import { assertEq } from '../../asserts/module.f.mjs'

const stringify = jsonStringify(sort)

/** The code points of a string. @type {(s: string) => readonly number[]} */
const codePoints = s => [...s].map(one)

const values = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]

export const proof = {
    range: () => {
        const r = stringify(range("A"))
        assertEq(r, '[65,65]')
    },
    hexDigitValue: {
        digit: () => {
            assertEq(hexDigitValue(one('0')), 0)
            assertEq(hexDigitValue(one('9')), 9)
        },
        latinSmallLetterAF: () => {
            assertEq(hexDigitValue(one('a')), 10)
            assertEq(hexDigitValue(one('f')), 15)
        },
        latinCapitalLetterAF: () => {
            assertEq(hexDigitValue(one('A')), 10)
            assertEq(hexDigitValue(one('F')), 15)
        },
        notAHexDigit: () => {
            assertEq(hexDigitValue(one('/')), null)
            assertEq(hexDigitValue(one(':')), null)
            assertEq(hexDigitValue(one('@')), null)
            assertEq(hexDigitValue(one('G')), null)
            assertEq(hexDigitValue(one('`')), null)
            assertEq(hexDigitValue(one('g')), null)
        },
    },
    lowerHexDigitValue: {
        digit: () => {
            assertEq(lowerHexDigitValue(one('0')), 0)
            assertEq(lowerHexDigitValue(one('9')), 9)
        },
        latinSmallLetterAF: () => {
            assertEq(lowerHexDigitValue(one('a')), 10)
            assertEq(lowerHexDigitValue(one('f')), 15)
        },
        latinCapitalLetterAF: () => {
            assertEq(lowerHexDigitValue(one('A')), null)
            assertEq(lowerHexDigitValue(one('F')), null)
        },
        notAHexDigit: () => {
            assertEq(lowerHexDigitValue(one('/')), null)
            assertEq(lowerHexDigitValue(one(':')), null)
            assertEq(lowerHexDigitValue(one('`')), null)
            assertEq(lowerHexDigitValue(one('g')), null)
        },
        notAnInteger: () => {
            assertEq(lowerHexDigitValue(97.5), null)
            assertEq(lowerHexDigitValue(NaN), null)
        },
        roundTrip: () => {
            assertEq(stringify(values.map(v => lowerHexDigitValue(hexDigitCodePoint(v)))), stringify(values))
        },
    },
    hexDigitCodePoint: {
        lowercaseDigits: () => {
            assertEq(String.fromCodePoint(...values.map(v => hexDigitCodePoint(v))), '0123456789abcdef')
        },
        roundTrip: () => {
            assertEq(stringify(values.map(v => hexDigitValue(hexDigitCodePoint(v)))), stringify(values))
        },
    },
    isCanonicalDigits: {
        canonical: () => {
            assertEq(isCanonicalDigits(codePoints('0')), true)
            assertEq(isCanonicalDigits(codePoints('7')), true)
            assertEq(isCanonicalDigits(codePoints('1234567890')), true)
        },
        empty: () => {
            assertEq(isCanonicalDigits([]), false)
        },
        leadingZero: () => {
            assertEq(isCanonicalDigits(codePoints('00')), false)
            assertEq(isCanonicalDigits(codePoints('010')), false)
        },
        notADigit: () => {
            assertEq(isCanonicalDigits(codePoints('A')), false)
            assertEq(isCanonicalDigits(codePoints('1a')), false)
            assertEq(isCanonicalDigits(codePoints('-1')), false)
            assertEq(isCanonicalDigits(codePoints(' 1')), false)
            assertEq(isCanonicalDigits(codePoints('/')), false)
            assertEq(isCanonicalDigits(codePoints(':')), false)
        },
        notAnInteger: () => {
            assertEq(isCanonicalDigits([48.5]), false)
            assertEq(isCanonicalDigits([0x31, NaN]), false)
        },
    },
    digitsValue: {
        decimal: () => {
            const decimal = digitsValue(10n)
            assertEq(decimal(codePoints('0')), 0n)
            assertEq(decimal(codePoints('42')), 42n)
            assertEq(decimal(codePoints('9223372036854775807')), 9223372036854775807n)
        },
        octal: () => {
            const octal = digitsValue(8n)
            assertEq(octal(codePoints('100644')), 33188n)
            assertEq(octal(codePoints('7')), 7n)
            assertEq(octal(codePoints('8')), null)
            assertEq(octal(codePoints('19')), null)
        },
        binary: () => {
            const binary = digitsValue(2n)
            assertEq(binary(codePoints('101')), 5n)
            assertEq(binary(codePoints('2')), null)
        },
        leadingZero: () => {
            assertEq(digitsValue(10n)(codePoints('007')), 7n)
        },
        empty: () => {
            assertEq(digitsValue(10n)([]), null)
            assertEq(digitsValue(8n)([]), null)
        },
        notADigit: () => {
            assertEq(digitsValue(10n)(codePoints('A')), null)
            assertEq(digitsValue(10n)(codePoints('1a')), null)
            assertEq(digitsValue(10n)(codePoints('/')), null)
            assertEq(digitsValue(10n)(codePoints(':')), null)
        },
        notAnInteger: () => {
            assertEq(digitsValue(10n)([48.5]), null)
            assertEq(digitsValue(10n)([NaN]), null)
        },
    },
    throw: {
        oneThrowsOnEmpty: () => one(''),
        digitsValueRadix16: () => digitsValue(16n),
        digitsValueRadix1: () => digitsValue(1n),
        digitsValueRadix0: () => digitsValue(0n),
    },
}
