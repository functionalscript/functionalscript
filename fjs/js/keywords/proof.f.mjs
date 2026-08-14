import { assertEq } from '../../asserts/module.f.mjs'
import { keywords, reservedWords, restrictedNames, strictModeReservedWords } from './module.f.mjs'

export const proof = {
    // `keywords` is exactly the sorted union of the groups plus `undefined`
    aggregate: () => {
        /** @type {readonly string[]} */
        const union = [...reservedWords, ...strictModeReservedWords, ...restrictedNames, 'undefined']
        // the names are unique, so the comparator never sees an equal pair
        assertEq(keywords.join(), union.toSorted((a, b) => a < b ? -1 : 1).join())
        assertEq(keywords.length, new Set(keywords).size)
    },
}
