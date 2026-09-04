/**
 * @import { Rule, Thunk, Variant } from '../../types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../../asserts/module.f.mjs'
import { force } from '../../testlib.f.mjs'
import { string, ws, wsSymbol } from '../json/module.f.mjs'
import { dataJs } from './module.f.mjs'

const { keys } = Object

const wsData = force(ws)

const ws1Data = /**@type {const}*/(['repeat', 1, Infinity, force(wsSymbol)])

const digitData = /**@type {const}*/(['set', 48, 58])

const digits0Data = /**@type {const}*/(['repeat', 0, Infinity, digitData])

const digitsData = /**@type {const}*/([digitData, digits0Data])

/**
 * The value a `const` thunk yields, as a variant. The grammar's `value` names
 * itself, so it cannot be expanded whole; this reads one level of it, and
 * checks that the level is the `const` one rather than a set or a repeat.
 *
 * @type {(t: Thunk) => Variant}
 */
const constVariant = t => {
    const [tag, r] = t()
    assertEq(tag, 'const')
    assert(typeof r === 'object' && r !== null && !(r instanceof Array))
    return /** @type {Variant} */ (r)
}

// The JSON alternatives in their order, `number` replaced in place, then the
// three DataJS extends it with.
const alternatives = /**@type {const}*/([
    'array', 'object', 'string', 'number', 'true', 'false', 'null',
    'nan', 'undefined', 'id',
])

/**
 * A statement is its keyword prefix, then a value, then `;`, with whitespace
 * allowed before and after the terminator.
 *
 * @type {(prefix: readonly unknown[]) => readonly unknown[]}
 */
const statementData = prefix => [...prefix, 'value', wsData, ';', wsData]

/**
 * A statement with its value thunk replaced by the name `'value'`, so the
 * self-naming rule can be compared without expanding it.
 *
 * @type {(s: Rule) => unknown}
 */
const statementOf = s => {
    assert(s instanceof Array)
    return s.map(r => r === value ? 'value' : force(r))
}

// `dataJs` is `[ws, const statements, export statement]`; every statement
// ends in the one `value` thunk, reached here through the export statement.
const [, constStatements, exportStatement] = dataJs

const valueRule = exportStatement[4]

assert(typeof valueRule === 'function')

const value = valueRule

const idData = /**@type {const}*/(['$', ['repeat', 0, Infinity, {
    letter: { lo: ['set', 97, 123], up: ['set', 65, 91], _: '_', $: '$' },
    digit: digitData,
}]])

export const proof = {
    // Zero or more `const` declarations, each `const $name = value;`. The
    // whitespace after `const` is mandatory — one or more symbols — where the
    // rest is optional.
    constStatements: () => {
        const [tag, min, max, statement] = constStatements()
        assertStructurallySame([tag, min, max], ['repeat', 0, Infinity])
        assertStructurallySame(
            statementOf(statement),
            statementData(['const', ws1Data, idData, wsData, '=', wsData]))
    },
    // One `export default value;`, with mandatory whitespace on both sides of
    // `default` so `exportdefault` and `default1` are rejected.
    exportStatement: () => {
        assertStructurallySame(
            statementOf(exportStatement),
            statementData(['export', ws1Data, 'default', ws1Data]))
    },
    // A module is one whitespace run, the declarations, and the export.
    dataJs: () => {
        assertStructurallySame(force(dataJs[0]), wsData)
        assertEq(dataJs.length, 3)
    },
    value: {
        // The seven JSON alternatives and three more, in that order.
        alternatives: () => {
            assertStructurallySame(keys(constVariant(value)), alternatives)
        },
        // A number is JSON's with a bigint suffix on the integer form and
        // `Infinity` as a word; the sign is shared by both.
        number: () => {
            assertStructurallySame(force(constVariant(value).number), [
                ['repeat', 0, 1, '-'],
                {
                    finite: [
                        { 0: '0', onenine: [['set', 49, 58], digits0Data] },
                        {
                            n: 'n',
                            optionFloatSuffix: [
                                ['repeat', 0, 1, ['.', digitsData]],
                                ['repeat', 0, 1, [
                                    ['set', 69, 70, 101, 102],
                                    ['repeat', 0, 1, ['set', 43, 44, 45, 46]],
                                    digitsData]]],
                        },
                    ],
                    infinity: 'Infinity',
                }])
        },
        // The words are terminal strings, and the string rule is JSON's own.
        words: () => {
            const v = constVariant(value)
            assertStructurallySame([v.nan, v.undefined], ['NaN', 'undefined'])
            assertEq(v.string, string)
        },
        // A reference is `$` followed by letters, digits, `_` and `$`.
        id: () => {
            assertStructurallySame(force(constVariant(value).id), idData)
        },
        // An object key is a JSON string or the one spelling of `__proto__`,
        // which is a literal: no whitespace inside it and no escapes.
        property: () => {
            const object = constVariant(value).object
            assert(object instanceof Array)
            const join = object[2]
            assert(typeof join === 'function')
            const [tag, , , item] = join()
            assertEq(tag, 'repeat')
            assert(item instanceof Array)
            const [pair] = item
            assert(pair instanceof Array)
            const [member] = pair
            assert(member instanceof Array)
            const [property] = member
            assert(typeof property === 'object' && property !== null && !(property instanceof Array))
            assertStructurallySame(keys(property), ['string', 'proto'])
            assertEq(property.string, string)
            assertStructurallySame(property.proto, '["__proto__"]')
        },
    },
}
