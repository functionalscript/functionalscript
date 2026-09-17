/**
 * @import { Assert } from '../../asserts/types.ts'
 * @import { Equal } from '../../types/ts/types.ts'
 */

import { assertEq } from '../../asserts/module.f.mjs'
import { keywords, literalGlobals, literalWords, reservedWords, restrictedNames, strictModeReservedWords } from './module.f.mjs'

export const proof = {
    // `keywords` is exactly the sorted union of the four groups
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
        /** @type {readonly string[]} */
        const union = [...reservedWords, ...strictModeReservedWords, ...restrictedNames, ...literalGlobals]
        // the names are unique, so the comparator never sees an equal pair
        assertEq(keywords.join(), union.toSorted((a, b) => a < b ? -1 : 1).join())
        assertEq(keywords.length, new Set(keywords).size)
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
