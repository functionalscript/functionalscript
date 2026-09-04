/**
 * @import { Rule } from '../../types.ts'
 */

import { assertEq, assertStructurallySame } from '../../../asserts/module.f.mjs'
import {
    array,
    cj,
    createValue,
    json,
    object,
    optionFloatSuffix,
    optionNeg,
    string,
    uint,
    ws,
    wsSymbol,
} from './module.f.mjs'
import { force } from '../../testlib.f.mjs'

const { keys } = Object

// The four whitespace symbols, as the run boundaries a set carries: tab and
// newline are adjacent, so they coalesce into one run, and carriage return and
// space stay runs of their own.
const wsSymbolData = /**@type {const}*/(['set', 9, 11, 13, 14, 32, 33])

const wsData = /**@type {const}*/(['repeat', 0, Infinity, wsSymbolData])

const digitData = /**@type {const}*/(['set', 48, 58])

const digits0Data = /**@type {const}*/(['repeat', 0, Infinity, digitData])

const digitsData = /**@type {const}*/([digitData, digits0Data])

/**
 * The shape `cj` builds, spelled out as data: the brackets outside, then
 * whitespace, then the items — optional as a whole, so an empty container is
 * one too — each followed by whitespace and separated by a comma that is
 * itself followed by whitespace.
 *
 * @type {(open: string, close: string, item: unknown) => unknown}
 */
const containerData = (open, close, item) => [
    open,
    wsData,
    ['repeat', 0, 1, [
        [item, wsData],
        ['repeat', 0, Infinity, [
            [',', wsData],
            [item, wsData]]]]],
    close]

const objectItemData = /**@type {const}*/(['p', wsData, ':', wsData, 'v'])

// The seven alternatives a JSON value has, in the order the variant lists them.
const alternatives =
    ['array', 'object', 'string', 'number', 'true', 'false', 'null']

export const proof = {
    // A symbol set, a repetition of it, and an option: the three thunks the
    // grammar is built from, at their simplest.
    wsSymbol: () => {
        assertStructurallySame(force(wsSymbol), wsSymbolData)
    },
    ws: () => {
        assertStructurallySame(force(ws), wsData)
    },
    optionNeg: () => {
        assertStructurallySame(force(optionNeg), ['repeat', 0, 1, '-'])
    },
    // An unsigned integer is `0` or a non-zero digit followed by any digits,
    // which is how a leading zero is excluded without a negative rule.
    uint: () => {
        assertStructurallySame(force(uint), {
            0: '0',
            onenine: [['set', 49, 58], digits0Data],
        })
    },
    // Both halves of what may follow an integer are optional and independent:
    // a fraction, an exponent, either, both, or neither.
    optionFloatSuffix: () => {
        assertStructurallySame(force(optionFloatSuffix), [
            ['repeat', 0, 1, ['.', digitsData]],
            ['repeat', 0, 1, [
                ['set', 69, 70, 101, 102],
                ['repeat', 0, 1, ['set', 43, 44, 45, 46]],
                digitsData]]])
    },
    // A string is quotes around any number of unescaped symbols and escapes.
    // The unescaped set is everything from a space to the last code point
    // minus the quote and the backslash — the two holes in that run are what
    // makes it a set rather than a range.
    string: () => {
        assertStructurallySame(force(string), [
            '"',
            ['repeat', 0, Infinity, {
                c: ['set', 32, 34, 35, 92, 93, 0x110000],
                escape: ['\\', {
                    c: [
                        'set',
                        34, 35, 47, 48, 92, 93, 98, 99,
                        102, 103, 110, 111, 114, 115, 116, 117],
                    u: ['u', ['repeat', 4, 4, {
                        digit: digitData,
                        AF: ['set', 65, 71],
                        af: ['set', 97, 103],
                    }]],
                }],
            }],
            '"'])
    },
    // `cj` takes the bracket pair as one two-symbol string, the same way
    // `range` does, so the two symbols cannot drift apart at a call site.
    cj: () => {
        assertStructurallySame(force(cj('()', 'x')), containerData('(', ')', 'x'))
    },
    // A delimiter above the BMP is one symbol, not the two UTF-16 units that
    // spell it, because spreading a string walks code points.
    cjAstral: () => {
        const brace = String.fromCodePoint(0x1D114)
        assertStructurallySame(
            force(cj(`${brace}${brace}`, 'x')),
            containerData(brace, brace, 'x'))
    },
    array: () => {
        assertStructurallySame(force(array('x')), containerData('[', ']', 'x'))
    },
    // An object is the same container over `property : value` pairs, with
    // whitespace allowed on both sides of the colon.
    object: () => {
        assertStructurallySame(
            force(object('p', 'v')),
            containerData('{', '}', objectItemData))
    },
    createValue: {
        // Exactly the seven alternatives, and the three keywords are terminal
        // strings rather than rules of their own.
        alternatives: () => {
            const v = createValue('p', 'v')
            assertStructurallySame(keys(v), alternatives)
            assertStructurallySame(
                [v.true, v.false, v.null],
                ['true', 'false', 'null'])
            assertEq(v.string, string)
        },
        // The property rule reaches the object alone; the value rule reaches
        // both containers. Passing them the other way round would build a
        // grammar whose keys are values.
        containers: () => {
            const v = createValue('p', 'v')
            assertStructurallySame(force(v.array), containerData('[', ']', 'v'))
            assertStructurallySame(
                force(v.object),
                containerData('{', '}', objectItemData))
        },
    },
    // A document is one value between two runs of whitespace. The value is a
    // thunk rather than the variant itself because a value contains values:
    // the grammar has to name itself, and here a name is a thunk, tagged
    // `const` because what it yields is a data rule. Expanding it is therefore
    // the only step this proof takes by hand.
    json: () => {
        const [before, value, after] = json
        assertStructurallySame([force(before), force(after)], [wsData, wsData])
        const [tag, variant] = value()
        assertEq(tag, 'const')
        assertStructurallySame(keys(variant), alternatives)
    },
    throw: {
        // The delimiters are exactly two symbols: one leaves the closing one
        // `undefined`, and three silently drops the last.
        cjRejectsOne: () => cj('(', 'x'),
        cjRejectsThree: () => cj('([)', 'x'),
        cjRejectsEmpty: () => cj('', 'x'),
    },
    /**
     * The grammar is a `Rule`, which is the whole point of a front end: a
     * consumer takes `json` through the advertised type. Nothing else states
     * that — the module pins `json` as a literal rather than annotating it, so
     * a shape that drifts out of the union would otherwise be caught at the
     * first consumer instead of here. The annotated binding is the check: a
     * `@typedef` in a function body is not resolved unless something uses it,
     * so an `Assert` written that way would pass whatever it claimed.
     */
    contract: () => {
        /** @type {Rule} */
        const rule = json
        assertEq(rule, json)
        // `Variant` is an abstraction: an alternative that isn't there is
        // typed as a rule and is `undefined` at runtime. `types.ts` pins the
        // type side of this; here is the value side it stands for.
        assertEq(createValue('p', 'v').missing, undefined)
    },
}
