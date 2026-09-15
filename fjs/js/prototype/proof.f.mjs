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
    // `prototypeNames` is exactly the sorted union of the seven lists —
    // at runtime here, and at the type level in `./types.ts`
    aggregate: () => {
        const union = new Set(lists.flat())
        assertEq(prototypeNames.join(), sorted([...union]))
        assertEq(prototypeNames.length, union.size)
    },
}
