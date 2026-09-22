import { assertEq } from '../../asserts/module.f.mjs'
import {
    allowedCalls, arrayPrototype, bigintPrototype, booleanPrototype, functionPrototype, numberPrototype,
    objectPrototype, prohibitedCalls, prototypeNames, stringPrototype,
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
    // `prohibitedCalls` and `allowedCalls` are each sorted, each name once,
    // and together they are exactly `prototypeNames`: every prototype name
    // has one call verdict — at runtime here, and at the type level in
    // `./types.ts`
    calls: () => {
        for (const names of [prohibitedCalls, allowedCalls]) {
            assertEq(names.join(), sorted(names))
            assertEq(names.length, new Set(names).size)
        }
        assertEq(sorted([...prohibitedCalls, ...allowedCalls]), prototypeNames.join())
        assertEq(prohibitedCalls.length + allowedCalls.length, prototypeNames.length)
        // the six data properties are no functions, so none is callable
        for (const name of ['__proto__', 'arguments', 'caller', 'constructor', 'length', 'name']) {
            assertEq(prohibitedCalls.includes(/** @type {any} */ (name)), true)
        }
    },
}
