import { assert, assertEq } from '../../asserts/module.f.mjs'
import {
    allowedCalls, arrayPrototype, bigintPrototype, booleanPrototype, functionPrototype, numberPrototype,
    objectPrototype, stringPrototype,
} from '../prototype/module.f.js'
import { runtime } from './module.f.js'

const { keys, values } = Object

/** The prototype each type's names come from, in the table's order. @type {readonly (readonly [string, readonly string[]])[]} */
const prototypes = [
    ['object', objectPrototype], ['array', arrayPrototype], ['string', stringPrototype], ['number', numberPrototype],
    ['boolean', booleanPrototype], ['bigint', bigintPrototype], ['function', functionPrototype],
]

/** @type {readonly string[]} */
const allowed = allowedCalls

/** The table by type name, for a proof that walks it. @type {Readonly<Record<string, Readonly<Record<string, unknown>>>>} */
const tables = runtime

export const proof = {
    // The keys are the admitted set: for each type, exactly the names
    // `allowedCalls` admits on its prototype, in the prototype's order,
    // which is sorted — the same claim `./types.ts` makes at the type level.
    keys: () => {
        assertEq(keys(tables).join(), prototypes.map(([type]) => type).join())
        for (const [type, names] of prototypes) {
            assertEq(keys(tables[type]).join(), names.filter(name => allowed.includes(name)).join())
        }
    },
    // Every entry is a body or the marker, nothing else.
    entries: () => {
        for (const table of values(tables)) {
            for (const entry of values(table)) {
                assert(entry === 'native' || typeof entry === 'function')
            }
        }
    },
    // The one body so far, on the host: `String.prototype.startsWith`'s
    // algorithm, case by case — the search converted, the position clamped
    // and truncated, an empty search found anywhere.
    startsWith: () => {
        const { startsWith } = runtime.string
        assertEq(startsWith('abc', 'ab', undefined), true)
        assertEq(startsWith('abc', 'bc', undefined), false)
        assertEq(startsWith('abc', 'bc', 1), true)
        assertEq(startsWith('abc', 'c', 2.9), true)
        assertEq(startsWith('abc', 'a', -1), true)
        assertEq(startsWith('abc', 'a', NaN), true)
        assertEq(startsWith('abc', '', 9), true)
        assertEq(startsWith('abc', '', Infinity), true)
        assertEq(startsWith('abc', 'c', Infinity), false)
        assertEq(startsWith('ab', 'abc', undefined), false)
        assertEq(startsWith('12', 1, undefined), true)
        assertEq(startsWith('undefinedx', undefined, undefined), true)
    },
    throw: {
        // A bigint position is the `TypeError` `ToNumber` throws.
        bigintPosition: () => { runtime.string.startsWith('abc', 'a', 0n) },
    },
}
