/**
 * @import { Unknown } from './types.ts'
 */

import { parse, stringify as extendedStringify } from './module.f.mjs'
import { sort } from '../../../types/object/module.f.mjs'
import { unwrap } from '../../../types/result/module.f.mjs'
import { assert, assertEq, assertStructurallySame } from '../../../asserts/module.f.mjs'

const stringify = extendedStringify(sort)

/**
 * The runtime type a token parses to, and the text that value serializes back
 * to — the two halves of the extended codec's round trip.
 *
 * @type {(text: string) => readonly [string, string]}
 */
const parsed = text => {
    const value = unwrap(parse(text))
    return [typeof value, stringify(value)]
}

/** @type {(text: string) => Unknown} */
const parseValue = text => unwrap(parse(text))

/** @type {(text: string) => string} */
const parseError = text => {
    const [tag, message] = parse(text)
    assertEq(tag, 'error')
    return `${message}`
}

// Long enough that `Number` of it is `Infinity` and `10 ** exponent` is not a
// computation anyone can afford.
const hugeExp = '99999999999999999999'

export const proof = {
    // bare integer syntax is `bigint`, whatever the magnitude
    bigint: {
        positive: () => assertStructurallySame(parsed('123'), ['bigint', '123']),
        negative: () => assertStructurallySame(parsed('-123'), ['bigint', '-123']),
        zero: () => assertStructurallySame(parsed('0'), ['bigint', '0']),
        // beyond `Number.MAX_SAFE_INTEGER`, so a materializer that went
        // through `number` first would round here
        beyondSafeInteger: () => {
            assertEq(parseValue('12345678901234567890123'), 12345678901234567890123n)
            assertEq(parseValue('-12345678901234567890123'), -12345678901234567890123n)
        },
        // an integer of a size no `number` can even approximate
        oversized: () => {
            const digits = `1${'0'.repeat(2000)}`
            assertStructurallySame(parsed(digits), ['bigint', digits])
            assertEq(parseValue(digits), 10n ** 2000n)
        },
    },
    // `.`/`e`/`E` means `number`, even when the value is a whole number
    number: {
        negativeZero: () => {
            assertStructurallySame(parsed('-0'), ['number', '-0'])
            // the sign is the whole point: `bigint` has no negative zero
            assert(Object.is(parseValue('-0'), -0))
        },
        fraction: () => assertStructurallySame(parsed('1.5'), ['number', '1.5']),
        wholeFraction: () => assertStructurallySame(parsed('1.0'), ['number', '1.0']),
        exponent: () => assertStructurallySame(parsed('1e3'), ['number', '1000.0']),
        capitalExponent: () => assertStructurallySame(parsed('1E3'), ['number', '1000.0']),
        negativeExponent: () => assertStructurallySame(parsed('1e-3'), ['number', '0.001']),
        // ordinary `number` rounding is not an error: an exponent below the
        // range is zero, as it is everywhere else in JavaScript
        underflow: () => assertStructurallySame(parsed('1e-400'), ['number', '0.0']),
        // a `number` big enough to spell itself with an exponent keeps that
        // spelling — appending `.0` to it would not even be valid JSON
        exponentSpelling: () => assertStructurallySame(parsed('1e21'), ['number', '1e+21']),
    },
    // a valid token the extended domain cannot represent is an ordinary
    // parse error, never `Infinity` and never a throw
    overflow: {
        exponent: () => assertEq(
            parseError('1e400'),
            'number is out of the finite range: 1e400'),
        negativeExponent: () => assertEq(
            parseError('-1e400'),
            'number is out of the finite range: -1e400'),
        // exponent text far beyond `number` precision: the tokenizer keeps
        // every digit, and the policy rejects the token rather than losing them
        unboundedExponent: () => assertEq(
            parseError(`1e${hugeExp}`),
            `number is out of the finite range: 1e${hugeExp}`),
        // malformed input is still an ordinary error
        malformed: () => assertEq(parseError('{'), 'unexpected end'),
    },
    containers: {
        array: () => assertEq(
            stringify(parseValue('[1,2.0,-0,"x",true,false,null]')),
            '[1,2.0,-0,"x",true,false,null]'),
        object: () => assertEq(
            stringify(parseValue('{"b":[1e2],"a":{"c":-7}}')),
            '{"a":{"c":-7},"b":[100.0]}'),
        // a missing property is not a leaf
        undefinedProperty: () => assertEq(stringify({ a: 1n, b: undefined }), '{"a":1}'),
    },
    // programmatic values: JSON has no syntax for these, so the serializer
    // spells them `null` — the same choice `JSON.stringify` makes
    nonFinite: {
        nan: () => assertEq(stringify(NaN), 'null'),
        infinity: () => assertEq(stringify(Infinity), 'null'),
        negativeInfinity: () => assertEq(stringify(-Infinity), 'null'),
    },
    // the spellings that keep `number` and `bigint` apart across a round trip
    serialize: {
        oneToOne: () => {
            assertEq(stringify(0n), '0')
            assertEq(stringify(0), '0.0')
            assertEq(stringify(-0), '-0')
            assertEq(stringify(3n), '3')
            assertEq(stringify(3), '3.0')
            assertEq(stringify(1.5), '1.5')
        },
        // a bigint is never shortened to exponent notation, however large:
        // that syntax would parse back as a `number`
        largeBigintHasNoExponent: () => {
            const text = stringify(10n ** 30n)
            assertEq(text, `1${'0'.repeat(30)}`)
            assertStructurallySame(parsed(text), ['bigint', text])
        },
    },
}
