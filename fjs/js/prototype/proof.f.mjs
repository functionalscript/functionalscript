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
    // and with `length` they are exactly `prototypeNames`: every prototype
    // name has one call verdict — at runtime here, and at the type level in
    // `./types.ts`. `length` is on neither list, as it is not on the read
    // list: a value owns it, and a call of it is a call of what it holds.
    calls: () => {
        for (const names of [prohibitedCalls, allowedCalls]) {
            assertEq(names.join(), sorted(names))
            assertEq(names.length, new Set(names).size)
            assertEq(/** @type {readonly string[]} */ (names).includes('length'), false)
        }
        assertEq(sorted([...prohibitedCalls, ...allowedCalls, 'length']), prototypeNames.join())
        assertEq(prohibitedCalls.length + allowedCalls.length + 1, prototypeNames.length)
        // the five data properties a read refuses are no functions, so none
        // is callable
        for (const name of ['__proto__', 'arguments', 'caller', 'constructor', 'name']) {
            assertEq(prohibitedCalls.includes(/** @type {any} */ (name)), true)
        }
    },
}
