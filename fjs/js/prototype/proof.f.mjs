/**
 * @import { Assert } from '../../asserts/types.ts'
 * @import { Equal } from '../../types/ts/types.ts'
 */

import { assert, assertEq } from '../../asserts/module.f.mjs'
import {
    arrayPrototype, bigintPrototype, booleanPrototype, functionPrototype, numberPrototype, objectPrototype,
    prototypeNames, stringPrototype,
} from './module.f.mjs'

const { hasOwn } = Object

/** Each list beside the prototype it names. @type {readonly (readonly [readonly string[], object])[]} */
const lists = [
    [objectPrototype, Object.prototype],
    [arrayPrototype, Array.prototype],
    [stringPrototype, String.prototype],
    [numberPrototype, Number.prototype],
    [booleanPrototype, Boolean.prototype],
    [bigintPrototype, BigInt.prototype],
    [functionPrototype, Function.prototype],
]

/** @type {(names: readonly string[]) => string} */
const sorted = names => names.toSorted((a, b) => a < b ? -1 : 1).join()

export const proof = {
    // each list is sorted, has each name once, and names properties the
    // running engine's prototype owns — the engine may own more, since
    // its prototypes grow with each release, and the list is the standard's
    lists: () => {
        for (const [names, prototype] of lists) {
            assertEq(names.join(), sorted(names))
            assertEq(names.length, new Set(names).size)
            assert(names.every(name => hasOwn(prototype, name)), names)
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
        const union = new Set(lists.flatMap(([names]) => names))
        assertEq(prototypeNames.join(), sorted([...union]))
        assertEq(prototypeNames.length, union.size)
    },
}
