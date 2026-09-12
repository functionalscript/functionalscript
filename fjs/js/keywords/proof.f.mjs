/**
 * @import { Assert } from '../../asserts/types.ts'
 * @import { Equal } from '../../types/ts/types.ts'
 */

import { assertEq } from '../../asserts/module.f.mjs'
import { keywords, literalGlobals, reservedWords, restrictedNames, strictModeReservedWords } from './module.f.mjs'

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
}
