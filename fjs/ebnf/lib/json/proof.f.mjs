/**
 * @import { Rule } from '../../types.ts'
 */

import { assert, assertStructurallySame } from '../../../asserts/module.f.mjs'
import {
    number,
    optionFloatSuffix,
    optionNeg,
    string,
    uint,
    ws,
    wsSymbol,
} from './module.f.mjs'

/** @type {(a: string) => number} */
const c = a => a.codePointAt(0) ?? 0

/**
 * The tuple a rule is. Every rule here is written in this file's own module, so
 * a rule of another shape is a mistake in the grammar rather than an input to
 * be handled.
 *
 * @type {(r: Rule) => readonly Rule[]}
 */
const tuple = r => {
    assert(r instanceof Array, r)
    return r
}

/**
 * The named alternatives a rule is.
 *
 * @type {(r: Rule) => { readonly[k in string]: Rule }}
 */
const variant = r => {
    assert(typeof r === 'object' && !(r instanceof Array), r)
    return r
}

/**
 * The tagged tuple behind a thunk. Reading one is what proves the thunk runs.
 *
 * @type {(r: Rule) => readonly unknown[]}
 */
const info = r => {
    assert(r instanceof Function, r)
    return r()
}

/**
 * The boundaries of a terminal set, without its `'set'` tag.
 *
 * @type {(r: Rule) => readonly unknown[]}
 */
const boundaries = r => info(r).slice(1)

/**
 * The rule under an unbounded repeat, checking the bounds on the way through.
 *
 * @type {(r: Rule) => Rule}
 */
const repeat0PlusOf = r => {
    const [tag, min, max, body] = info(r)
    assertStructurallySame([tag, min, max], ['repeat', 0, Infinity])
    return /** @type {Rule} */(body)
}

/**
 * The rule under an option.
 *
 * @type {(r: Rule) => Rule}
 */
const optionOf = r => {
    const [tag, min, max, body] = info(r)
    assertStructurallySame([tag, min, max], ['repeat', 0, 1])
    return /** @type {Rule} */(body)
}

export const proof = {
    string: {
        // A string is its two quotes with a repeat of body symbols between.
        quoted: () => {
            const s = tuple(string)
            assertStructurallySame([s[0], s[2]], ['"', '"'])
            assertStructurallySame(s.length, 3)
        },
        // The body is either a raw symbol or an escape, and nothing else.
        body: () => {
            const body = variant(repeat0PlusOf(tuple(string)[1]))
            assertStructurallySame(Object.keys(body).toSorted(), ['c', 'escape'])
        },
        // The raw symbol is every symbol from a space up, less the two a JSON
        // string cannot carry — which is the gap `remove` opens in the run.
        rawSymbol: () => {
            assertStructurallySame(
                boundaries(variant(repeat0PlusOf(tuple(string)[1])).c),
                [
                    c(' '), c('"'), c('"') + 1,
                    c('\\'), c('\\') + 1, 0x10FFFF + 1,
                ])
        },
        // An escape is a backslash and then one of the two forms.
        escape: () => {
            const escape = tuple(variant(repeat0PlusOf(tuple(string)[1])).escape)
            assertStructurallySame(escape[0], '\\')
            const forms = variant(escape[1])
            assertStructurallySame(Object.keys(forms).toSorted(), ['c', 'u'])
            // The single-symbol form, spelled out rather than as a range.
            assertStructurallySame(
                boundaries(forms.c),
                [
                    c('"'), c('"') + 1, c('/'), c('/') + 1,
                    c('\\'), c('\\') + 1, c('b'), c('b') + 1,
                    c('f'), c('f') + 1, c('n'), c('n') + 1,
                    c('r'), c('r') + 1, c('t'), c('t') + 1,
                ])
        },
        // `\u` takes exactly four hex digits — a fixed repeat, not `0+`.
        unicodeEscape: () => {
            const forms = variant(tuple(variant(repeat0PlusOf(tuple(string)[1])).escape)[1])
            const u = tuple(forms.u)
            assertStructurallySame(u[0], 'u')
            const [tag, min, max, hex] = info(u[1])
            assertStructurallySame([tag, min, max], ['repeat', 4, 4])
            const h = variant(/** @type {Rule} */(hex))
            assertStructurallySame(Object.keys(h).toSorted(), ['AF', 'af', 'digit'])
            assertStructurallySame(boundaries(h.digit), [c('0'), c('9') + 1])
            assertStructurallySame(boundaries(h.AF), [c('A'), c('F') + 1])
            assertStructurallySame(boundaries(h.af), [c('a'), c('f') + 1])
        },
    },
    optionNeg: () => {
        assertStructurallySame(optionOf(optionNeg), '-')
    },
    uint: {
        // Zero is spelled by itself: a leading zero is not a JSON number, which
        // is why this is a variant rather than one digit repeat.
        alternatives: () => {
            assertStructurallySame(Object.keys(uint).toSorted(), ['0', 'onenine'])
            assertStructurallySame(uint[0], '0')
        },
        // Every other number opens with `1..9` and continues with any digits.
        onenine: () => {
            const [head, rest] = tuple(uint.onenine)
            assertStructurallySame(boundaries(head), [c('1'), c('9') + 1])
            assertStructurallySame(
                boundaries(repeat0PlusOf(rest)),
                [c('0'), c('9') + 1])
        },
    },
    optionFloatSuffix: {
        // Both halves are optional, which is what makes an integer a number.
        optional: () => {
            assertStructurallySame(optionFloatSuffix.length, 2)
        },
        // A fraction is a point and at least one digit.
        fraction: () => {
            const [point, digits] = tuple(optionOf(optionFloatSuffix[0]))
            assertStructurallySame(point, '.')
            const [head, rest] = tuple(digits)
            assertStructurallySame(boundaries(head), [c('0'), c('9') + 1])
            assertStructurallySame(
                boundaries(repeat0PlusOf(rest)),
                [c('0'), c('9') + 1])
        },
        // An exponent is `e` in either case, an optional sign, and digits.
        exponent: () => {
            const [e, sign, digits] = tuple(optionOf(optionFloatSuffix[1]))
            assertStructurallySame(
                boundaries(e),
                [c('E'), c('E') + 1, c('e'), c('e') + 1])
            assertStructurallySame(
                boundaries(optionOf(sign)),
                [c('+'), c('+') + 1, c('-'), c('-') + 1])
            assertStructurallySame(
                boundaries(tuple(digits)[0]),
                [c('0'), c('9') + 1])
        },
    },
    // A number is the sign, the integer part, and the float suffix spread flat,
    // so its parts are the very rules the module exports.
    number: () => {
        assertStructurallySame(number.length, 4)
        assert(number[0] === optionNeg, number)
        assert(number[1] === uint, number)
        assert(number[2] === optionFloatSuffix[0], number)
        assert(number[3] === optionFloatSuffix[1], number)
    },
    ws: {
        // The four symbols JSON allows between tokens: tab and newline are
        // adjacent, so they coalesce into one run.
        symbol: () => {
            assertStructurallySame(
                boundaries(wsSymbol),
                [
                    c('\t'), c('\n') + 1,
                    c('\r'), c('\r') + 1,
                    c(' '), c(' ') + 1,
                ])
        },
        // Whitespace is any number of them, including none.
        repeat: () => {
            assert(repeat0PlusOf(ws) === wsSymbol, ws)
        },
    },
}
