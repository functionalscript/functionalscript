/**
 * @import { Assert } from '../../asserts/types.ts'
 * @import { Equal } from '../../types/ts/types.ts'
 */

import { assertEq } from '../../asserts/module.f.mjs'
import {
    arrayPrototype, bigintPrototype, booleanPrototype, functionPrototype, numberPrototype, objectPrototype,
    prototypeNames, stringPrototype,
} from './module.f.mjs'

/** @type {readonly (readonly string[])[]} */
const lists = [objectPrototype, arrayPrototype, stringPrototype, numberPrototype, booleanPrototype, bigintPrototype, functionPrototype]

/** @type {(names: readonly string[]) => string} */
const sorted = names => names.toSorted((a, b) => a < b ? -1 : 1).join()

export const proof = {
    // each list is sorted and has each name once; none is checked against
    // the running engine, which is no reference — a newer release owns
    // more, and Deno deletes `Object.prototype.__proto__`
    lists: () => {
        for (const names of lists) {
            assertEq(names.join(), sorted(names))
            assertEq(names.length, new Set(names).size)
        }
    },
    // `prototypeNames` is exactly the sorted union of the seven lists
    aggregate: () => {
        /**
         * @typedef {Assert<Equal<
         *  typeof prototypeNames[number],
         *  | typeof objectPrototype[number]
         *  | typeof arrayPrototype[number]
         *  | typeof stringPrototype[number]
         *  | typeof numberPrototype[number]
         *  | typeof booleanPrototype[number]
         *  | typeof bigintPrototype[number]
         *  | typeof functionPrototype[number]
         * >>} _NamesPinned
         */
        const union = new Set(lists.flat())
        assertEq(prototypeNames.join(), sorted([...union]))
        assertEq(prototypeNames.length, union.size)
    },
}
