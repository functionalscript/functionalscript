import { hexDigitCodePoint, hexDigitValue, one, range } from './module.f.mjs'
import { stringify as jsonStringify } from '../../media/json/module.f.mjs'
import { sort } from '../../types/object/module.f.mjs'
import { assertEq } from '../../asserts/module.f.mjs'

const stringify = jsonStringify(sort)

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
            assertEq(hexDigitValue(one('g')), null)
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
    throw: {
        oneThrowsOnEmpty: () => one(''),
    },
}
