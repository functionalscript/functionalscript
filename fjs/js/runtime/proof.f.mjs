import { assert, assertEq } from '../../asserts/module.f.mjs'
import {
    allowedCalls, arrayPrototype, bigintPrototype, booleanPrototype, functionPrototype, numberPrototype,
    objectPrototype, stringPrototype,
} from '../prototype/module.f.js'
import { runtime } from './module.f.js'

const { entries, values } = Object

/** The prototype each receiver type's names come from. @type {Readonly<Record<string, readonly string[] | undefined>>} */
const prototypes = {
    object: objectPrototype, array: arrayPrototype, string: stringPrototype, number: numberPrototype,
    boolean: booleanPrototype, bigint: bigintPrototype, function: functionPrototype,
}

/** @type {readonly string[]} */
const allowed = allowedCalls

/** The table by type name, for a proof that walks it. @type {Readonly<Record<string, Readonly<Record<string, unknown>>>>} */
const tables = runtime

export const proof = {
    // Every type the table keys is a receiver type, and every key under it
    // is a name `allowedCalls` admits on that type's prototype — the same
    // claim `./types.ts` makes at the type level — and every entry is a
    // body.
    keys: () => {
        for (const [type, table] of entries(tables)) {
            const names = prototypes[type]
            assert(names !== undefined, type)
            for (const [name, entry] of entries(table)) {
                assert(names.includes(name) && allowed.includes(name), name)
                assertEq(typeof entry, 'function')
            }
        }
        assert(values(tables).length > 0)
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
