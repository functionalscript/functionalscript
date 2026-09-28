/**
 * @import { Assert } from '../../asserts/types.ts'
 * @import { Equal } from '../../types/ts/types.ts'
 */

import { assertEq } from '../../asserts/module.f.mjs'
import { keywords, literalGlobals, literalWords, reservedWords, restrictedNames, strictModeReservedWords } from './module.f.mjs'

export const proof = {
    // `keywords` is derived from the four groups; what the derivation does
    // not give by construction is that no name is in two groups — strictly
    // ascending means sorted and each name once. The order is by code unit,
    // so the capitalized globals come first. The type-level pin keeps the
    // element type the literal union rather than `string`.
    aggregate: () => {
        /**
         * @typedef {Assert<Equal<
         *  typeof keywords[number],
         *  | typeof reservedWords[number]
         *  | typeof strictModeReservedWords[number]
         *  | typeof restrictedNames[number]
         *  | typeof literalGlobals[number]
         * >>} _KeywordsPinned
         */
        assertEq(keywords.every((w, i) => i === 0 || keywords[i - 1] < w), true)
        assertEq(keywords.slice(0, 3).join(), 'Infinity,NaN,arguments')
    },
    // `literalWords` is the three literals the reserved words hold and the
    // three literal globals, and nothing else — a keyword either denotes a
    // value or may name one, and which of the two a word is decides whether
    // a tokenizer gives it a kind of its own.
    literal: () => {
        /** @type {readonly string[]} */
        const words = literalWords
        const reserved = new Set(/** @type {readonly string[]} */(reservedWords))
        const globals = new Set(/** @type {readonly string[]} */(literalGlobals))
        const all = new Set(/** @type {readonly string[]} */(keywords))
        assertEq(words.join(), 'Infinity,NaN,false,null,true,undefined')
        assertEq(words.filter(w => reserved.has(w)).join(), 'false,null,true')
        assertEq(words.filter(w => globals.has(w)).join(), literalGlobals.join())
        assertEq(words.filter(w => all.has(w)).length, words.length)
    },
}
