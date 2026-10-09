/**
 * @import { List } from '../../../types/list/types.ts'
 */

import { arrayWrap, boolSerialize, codec, leafSerialize, nullSerialize, numberSerialize, objectWrap, stringSerialize } from './module.f.mjs'
import * as list from '../../../types/list/module.f.mjs'
import { sort } from '../../../types/object/module.f.mjs'
import { chunksText } from '../../../text/marked/module.f.mjs'
import { assertEq } from '../../../asserts/module.f.mjs'

const { toArray } = list

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

// The expected literals below are what the host's `JSON.stringify` produces for
// the same input; `stringSerialize` has to reproduce them exactly, so any
// divergence in the FunctionalScript escaping shows up here as a failure.
/** @type {(input: string) => string} */
const serialized = input => chunksText(stringSerialize(input))

export const proof = {
    arrayWrap: [
        () => {
            const result = JSON.stringify(toArray(arrayWrap(null)))
            assertEq(result, '["[","]"]')
        },
        () => {
            const result = JSON.stringify(toArray(arrayWrap([['a','b']])))
            assertEq(result, '["[","a","b","]"]')
        },
        () => {
            const result = JSON.stringify(toArray(arrayWrap([['a'],['b']])))
            assertEq(result, '["[","a",",","b","]"]')
        }
    ],
    objectWrap: [
        () => {
            const result = JSON.stringify(toArray(objectWrap(null)))
            if (result !== '["{","}"]') { throw result }
        },
        () => {
            const result = JSON.stringify(toArray(objectWrap([['a','b']])))
            if (result !== '["{","a","b","}"]') { throw result }
        },
        () => {
            const result = JSON.stringify(toArray(objectWrap([['a'],['b']])))
            if (result !== '["{","a",",","b","}"]') { throw result }
        }
    ],
    stringSerialize: [
        () => { assertEq(serialized('abc'), '"abc"') },
        () => { assertEq(serialized('123'), '"123"') },
        () => { assertEq(serialized(''), '""') },
        // one chunk, like every other leaf serializer in this module
        () => { assertEq(toArray(stringSerialize('a"')).length, 1) },
        // the two escapes JSON requires outside the control block
        () => { assertEq(serialized('a"b'), '"a\\"b"') },
        () => { assertEq(serialized('a\\b'), '"a\\\\b"') },
        // every named control escape
        () => { assertEq(serialized('\b\f\n\r\t'), '"\\b\\f\\n\\r\\t"') },
        // control code points without a named escape, covering both hex-digit
        // halves: '0'-'9' and 'a'-'f'
        () => { assertEq(serialized('\u0000'), '"\\u0000"') },
        () => { assertEq(serialized('\u000b'), '"\\u000b"') },
        () => { assertEq(serialized('\u001f'), '"\\u001f"') },
        // `space` is the first code point copied through unescaped, and DEL is
        // not a JSON escape at all
        () => { assertEq(serialized(' \u007f'), '" \u007f"') },
        // a surrogate pair decodes to one code point and survives unchanged
        () => { assertEq(serialized('😀'), '"😀"') },
        // unpaired surrogates, well-formed-stringify escaped: leading, trailing,
        // in the middle, doubled, and left over at end of input
        () => { assertEq(serialized('\ud800'), '"\\ud800"') },
        () => { assertEq(serialized('\udfff'), '"\\udfff"') },
        () => { assertEq(serialized('a\udc00b'), '"a\\udc00b"') },
        () => { assertEq(serialized('\ud800\ud800'), '"\\ud800\\ud800"') },
        () => { assertEq(serialized('a\ud83d'), '"a\\ud83d"') },
    ],
    numberSerialize: [
        () => {
            const result = JSON.stringify(toArray(numberSerialize(123)))
            assertEq(result, '[["123","number"]]')
        },
        () => {
            const result = JSON.stringify(toArray(numberSerialize(10e20)))
            assertEq(result, '[["1e+21","number"]]')
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
            assertEq(JSON.stringify(toArray(numberSerialize(NaN))), '[["null","literal"]]')
        },
    ],
    boolSerialize: [
        () => {
            const result = JSON.stringify(toArray(boolSerialize(false)))
            assertEq(result, '[["false","literal"]]')
        },
        () => {
            const result = JSON.stringify(toArray(boolSerialize(true)))
            assertEq(result, '[["true","literal"]]')
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
        assertEq(JSON.stringify(toArray(stringSerialize('a'))), '[["\\"a\\"","string"]]')
        assertEq(JSON.stringify(toArray(nullSerialize)), '[["null","literal"]]')
        // punctuation stays plain
        assertEq(JSON.stringify(toArray(arrayWrap([nullSerialize]))), '["[",["null","literal"],"]"]')
    },
    codec: () => {
        const { serialize, stringify } = codec(plain)
        assertEq(stringify(sort)({ b: [1, null], a: 'x' }), '{"a":"x","b":[#1,null]}')
        assertEq(JSON.stringify(toArray(serialize(sort)([true]))), '["[","true","]"]')
    },
}
