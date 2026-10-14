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
    // The escaping itself is `stringLiteral`'s, proven in `fjs/js/string_escape`.
    stringSerialize: [
        () => { assertEq(chunksText(stringSerialize('a"b')), '"a\\"b"') },
        // one chunk, like every other leaf serializer in this module
        () => { assertEq(toArray(stringSerialize('a"')).length, 1) },
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
        const { serialize, stringify, marked } = codec(plain)
        assertEq(stringify(sort)({ b: [1, null], a: 'x' }), '{"a":"x","b":[#1,null]}')
        assertEq(JSON.stringify(toArray(serialize(sort)([true]))), '["[","true","]"]')
        // the same walk as runs: the leaves with their kinds, the containers plain
        assertEq(JSON.stringify(marked(sort)([true, 'x'])), '[["["],["true","literal"],[","],["\\"x\\"","string"],["]"]]')
    },
}
