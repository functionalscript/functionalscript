/**
 * @import { Grammar } from './types.ts'
 * @import { ByteSet } from '../types/byte_set/types.ts'
 */

import { dfa, run, toRange } from './module.f.mjs'
import { one, union, empty, range as byteSetRange } from '../types/byte_set/module.f.mjs'
import { toKey } from '../types/sorted_set/module.f.mjs'
import { fold, toArray } from '../types/list/module.f.mjs'
import { stringToList } from '../text/utf16/module.f.mjs'
import { assertEq, assertStructurallySame } from '../asserts/module.f.mjs'


/**
 * The byte set of a string's characters, used to spell a grammar's punctuation
 * alphabets below. It lives here rather than in `fjs/fsm` or `types/byte_set`:
 * `fjs/fsm` has no use for it, and a `types` leaf taking a *string* would have
 * to depend on `fjs/text` to read one.
 *
 * @type {(s: string) => ByteSet}
 */
const toUnion = s =>
    fold((/** @type {number} */i) => (/** @type {ByteSet} */bs) => union(bs)(one(i)))(empty)(stringToList(s))

const buildDfa = () => {
    const lowercaseAlpha = toRange('az')
    const uppercaseAlpha = toRange('AZ')
    const alpha = union(lowercaseAlpha)(uppercaseAlpha)
    const idSymbol = toUnion('_$')
    const idBegin = union(alpha)(idSymbol)
    const digit = toRange('09')
    const idNext = union(idBegin)(digit)
    const dot = toUnion('.')

    /** @type {Grammar} */
    const grammar = [
        ['', digit, 'int'],
        ['int', digit, 'int'],
        ['', digit, 'floatBegin'],
        ['floatBegin', digit, 'floatBegin'],
        ['floatBegin', dot, 'floatDot'],
        ['floatDot', digit, 'float'],
        ['float', digit, 'float'],
        ['', idBegin, 'id'],
        ['id', idNext, 'id']
    ]
    return dfa(grammar)
}

export const proof = {
    toRange: [
        // Two characters name the inclusive range's endpoints.
        () => assertEq(toRange('az'), byteSetRange([0x61, 0x7a])),
        // One character is the singleton range. This threw `RangeError: The
        // number NaN cannot be converted to a BigInt` while `toRange` read a
        // second character that was not there.
        () => assertEq(toRange('a'), byteSetRange([0x61, 0x61])),
        () => assertEq(toRange('a'), one(0x61)),
        () => assertEq(toRange('\0'), one(0)),
    ],
    // The expected states are written as the sets they are, keyed through
    // `toKey`, so this proof asserts the automaton and not the key encoding.
    dfa: () => assertStructurallySame(buildDfa(), {
        [toKey([''])]: [
            [toKey([]), 35],
            [toKey(['id']), 36],
            [toKey([]), 47],
            [toKey(['floatBegin', 'int']), 57],
            [toKey([]), 64],
            [toKey(['id']), 90],
            [toKey([]), 94],
            [toKey(['id']), 95],
            [toKey([]), 96],
            [toKey(['id']), 122],
        ],
        [toKey(['float'])]: [[toKey([]), 47], [toKey(['float']), 57]],
        [toKey(['floatBegin', 'int'])]: [
            [toKey([]), 45],
            [toKey(['floatDot']), 46],
            [toKey([]), 47],
            [toKey(['floatBegin', 'int']), 57],
        ],
        [toKey(['floatDot'])]: [[toKey([]), 47], [toKey(['float']), 57]],
        [toKey(['id'])]: [
            [toKey([]), 35],
            [toKey(['id']), 36],
            [toKey([]), 47],
            [toKey(['id']), 57],
            [toKey([]), 64],
            [toKey(['id']), 90],
            [toKey([]), 94],
            [toKey(['id']), 95],
            [toKey([]), 96],
            [toKey(['id']), 122],
        ],
        [toKey([])]: [],
    }),
    run: [
        () => assertStructurallySame(
            toArray(run(buildDfa())(stringToList('a1'))),
            [toKey(['id']), toKey(['id'])]),
        () => assertStructurallySame(
            toArray(run(buildDfa())(stringToList('0.1'))),
            [toKey(['floatBegin', 'int']), toKey(['floatDot']), toKey(['float'])]),
        () => assertStructurallySame(
            toArray(run(buildDfa())(stringToList('//'))),
            [toKey([]), toKey([])]),
        () => assertStructurallySame(
            toArray(run(buildDfa())(stringToList('::'))),
            [toKey([]), toKey([])]),
        // `run` accepts any `Dfa` (a `StringMap`, so entries may be missing),
        // not only one built by `dfa()`. A state absent from the map falls
        // back to the empty transition table.
        () => assertStructurallySame(
            toArray(run({})(stringToList('a'))),
            [toKey([])]),
    ],
}
