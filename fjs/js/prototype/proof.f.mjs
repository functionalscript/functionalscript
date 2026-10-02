import { assertEq } from '../../asserts/module.f.mjs'
import {
    allowedCalls, arrayPrototype, bigintPrototype, booleanPrototype, functionPrototype, numberPrototype,
    objectPrototype, prohibitedCalls, prototypeNames, stringPrototype,
} from './module.f.js'

/** @type {readonly (readonly string[])[]} */
const lists = [objectPrototype, arrayPrototype, stringPrototype, numberPrototype, booleanPrototype, bigintPrototype, functionPrototype]

/** Sorted by code unit, each name once. @type {(names: readonly string[]) => boolean} */
const ascending = names => names.every((name, i) => i === 0 || names[i - 1] < name)

export const proof = {
    // each list is sorted and has each name once; none is checked against
    // the running engine, which is no reference — a newer release owns
    // more, and Deno deletes `Object.prototype.__proto__`
    lists: () => {
        for (const names of lists) {
            assertEq(ascending(names), true)
        }
    },
    // `prototypeNames` is derived from the seven lists; what the derivation
    // does not show at a glance is that it dropped every repeat and nothing
    // else — strictly ascending, and as many names as the union. The
    // type-level pin in `./types.ts` keeps the element type the literal union
    // rather than `string`.
    aggregate: () => {
        assertEq(ascending(prototypeNames), true)
        assertEq(prototypeNames.length, new Set(lists.flat()).size)
    },
    // `prohibitedCalls` and `allowedCalls` are each sorted, each name once,
    // and with `length` they are exactly `prototypeNames`: every prototype
    // name has one call verdict — at runtime here, and at the type level in
    // `./types.ts`. `length` is on neither list, as it is not on the read
    // list: a value owns it, and a call of it is a call of what it holds.
    calls: () => {
        for (const names of [prohibitedCalls, allowedCalls]) {
            assertEq(ascending(names), true)
            assertEq(/** @type {readonly string[]} */ (names).includes('length'), false)
        }
        assertEq([...prohibitedCalls, ...allowedCalls, 'length'].toSorted().join(), prototypeNames.join())
        assertEq(prohibitedCalls.length + allowedCalls.length + 1, prototypeNames.length)
        // the five data properties a read refuses are no functions, so none
        // is callable
        for (const name of ['__proto__', 'arguments', 'caller', 'constructor', 'name']) {
            assertEq(prohibitedCalls.includes(/** @type {any} */ (name)), true)
        }
    },
}
