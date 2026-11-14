/**
 * @import { List } from '../../../types/list/types.ts'
 */

import { arrayWrap, boolSerialize, codec, leafSerialize, nullSerialize, numberSerialize, objectWrap, stringSerialize } from './module.f.mjs'
import { toArray } from '../../../types/list/alt/module.f.js'
import { sort } from '../../../types/object/module.f.js'
import { chunksText } from '../../../text/marked/module.f.js'
import { assertEq, assertStructurallySame } from '../../../asserts/module.f.js'

/** @type {(value: number) => List<string>} */
const hash = value => [`#${value}`]

const plain = leafSerialize(hash)({})

const full = leafSerialize(hash)({
    bigint: value => [`${value}n`],
    undefined: () => ['undefined'],
})

/**
 * A leaf a configuration has no arm for. Only a cast delivers one past
 * `_Leaves`, and the cast is the point: the builder must refuse it rather
 * than spell it `null`.
 *
 * @type {(value: unknown) => never}
 */
const unchecked = value => /** @type {never} */ (value)

export const proof = {
    arrayWrap: [
        () => {
            assertStructurallySame(toArray(arrayWrap(null)), ['[', ']'])
        },
        () => {
            assertStructurallySame(toArray(arrayWrap([['a', 'b']])), ['[', 'a', 'b', ']'])
        },
        () => {
            assertStructurallySame(toArray(arrayWrap([['a'], ['b']])), ['[', 'a', ',', 'b', ']'])
        }
    ],
    objectWrap: [
        () => {
            assertStructurallySame(toArray(objectWrap(null)), ['{', '}'])
        },
        () => {
            assertStructurallySame(toArray(objectWrap([['a', 'b']])), ['{', 'a', 'b', '}'])
        },
        () => {
            assertStructurallySame(toArray(objectWrap([['a'], ['b']])), ['{', 'a', ',', 'b', '}'])
        }
    ],
    // The escaping itself is `stringLiteral`'s, proven in `fjs/js/string_escape`.
    stringSerialize: [
        () => { assertEq(chunksText(stringSerialize('a"b')), '"a\\"b"') },
        // one chunk, like every other leaf serializer in this module
        () => { assertEq(toArray(stringSerialize('a"')).length, 1) },
    ],
    numberSerialize: [
        () => {
            assertStructurallySame(toArray(numberSerialize(123)), [['123', 'number']])
        },
        () => {
            assertStructurallySame(toArray(numberSerialize(10e20)), [['1e+21', 'number']])
        },
        // Decimal/exponent thresholds, precision, and finite range endpoints.
        () => {
            /** @type {readonly (readonly [number, string])[]} */
            const cases = [
                [1e-7, '1e-7'],
                [9.999999999999997e-7, '9.999999999999997e-7'],
                [1e-6, '0.000001'],
                [0.0000010000000000000002, '0.0000010000000000000002'],
                [1e20, '100000000000000000000'],
                [9.999999999999999e20, '999999999999999900000'],
                [1e21, '1e+21'],
                [-1e21, '-1e+21'],
                [0.10000000000000002, '0.10000000000000002'],
                [1_000_000_000_000_000_100, '1000000000000000100'],
                [9_007_199_254_740_991, '9007199254740991'],
                [9_007_199_254_740_992, '9007199254740992'],
                [5e-324, '5e-324'],
                [2.2250738585072014e-308, '2.2250738585072014e-308'],
                [1.7976931348623157e308, '1.7976931348623157e+308'],
            ]
            for (const [value, text] of cases) {
                assertStructurallySame(toArray(numberSerialize(value)), [[text, 'number']])
            }
        },
        // `-0` keeps its sign, where `JSON.stringify` writes `0`; `0` stays `0`
        () => {
            assertEq(chunksText(numberSerialize(-0)), '-0')
            assertEq(chunksText(numberSerialize(0)), '0')
        },
        // no JSON spelling: `null`, as `JSON.stringify` writes them, and a literal
        () => {
            assertEq(chunksText(numberSerialize(NaN)), 'null')
            assertEq(chunksText(numberSerialize(Infinity)), 'null')
            assertEq(chunksText(numberSerialize(-Infinity)), 'null')
            assertStructurallySame(toArray(numberSerialize(NaN)), [['null', 'literal']])
        },
    ],
    boolSerialize: [
        () => {
            assertStructurallySame(toArray(boolSerialize(false)), [['false', 'literal']])
        },
        () => {
            assertStructurallySame(toArray(boolSerialize(true)), [['true', 'literal']])
        }
    ],
    leafSerialize: {
        shared: () => {
            assertEq(chunksText(plain(true)), 'true')
            assertEq(chunksText(plain(1.5)), '#1.5')
            assertEq(chunksText(plain('a')), '"a"')
            assertEq(chunksText(plain(null)), 'null')
        },
        extra: () => {
            assertEq(chunksText(full(1n)), '1n')
            assertEq(chunksText(full(undefined)), 'undefined')
            assertEq(chunksText(full(false)), 'false')
        },
        throw: {
            bigint: () => plain(unchecked(1n)),
            undefined: () => plain(unchecked(undefined)),
        },
    },
    kinds: () => {
        assertStructurallySame(toArray(stringSerialize('a')), [['"a"', 'string']])
        assertStructurallySame(toArray(nullSerialize), [['null', 'literal']])
        // punctuation stays plain
        assertStructurallySame(toArray(arrayWrap([nullSerialize])), ['[', ['null', 'literal'], ']'])
    },
    codec: () => {
        const { serialize, stringify, marked } = codec(plain)
        assertEq(stringify(sort)({ b: [1, null], a: 'x' }), '{"a":"x","b":[#1,null]}')
        assertStructurallySame(toArray(serialize(sort)([true])), ['[', 'true', ']'])
        // the same walk as runs: the leaves with their kinds, the containers plain
        assertStructurallySame(marked(sort)([true, 'x']), [['['], ['true', 'literal'], [','], ['"x"', 'string'], [']']])
    },
}
