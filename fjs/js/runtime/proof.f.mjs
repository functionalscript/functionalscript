import { assert, assertEq } from '../../asserts/module.f.mjs'
import {
    allowedCalls, arrayPrototype, bigintPrototype, booleanPrototype, functionPrototype, numberPrototype,
    objectPrototype, stringPrototype,
} from '../prototype/module.f.js'
import { isStatic } from '../static/module.f.js'
import { is } from '../../types/object/is/module.f.js'
import { isFinite_ } from '../../types/number/is_finite/module.f.js'
import { isInteger } from '../../types/number/is_integer/module.f.js'
import { isNaN_ } from '../../types/number/is_nan/module.f.js'
import { isSafeInteger } from '../../types/number/is_safe_integer/module.f.js'
import { runtime } from './module.f.js'

const { entries, values } = Object

/** The prototype each receiver type's names come from, by its global's name. @type {Readonly<Record<string, readonly string[] | undefined>>} */
const prototypes = {
    Object: objectPrototype, Array: arrayPrototype, String: stringPrototype, Number: numberPrototype,
    Boolean: booleanPrototype, BigInt: bigintPrototype, Function: functionPrototype,
}

/** @type {readonly string[]} */
const allowed = allowedCalls

/** The member section by type name, for a proof that walks it. @type {Readonly<Record<string, Readonly<Record<string, unknown>>>>} */
const tables = runtime.member

export const proof = {
    // `member` and `static` are the two sections; every type `member`
    // keys is a receiver type by its global's name, and every key under it
    // is a name `allowedCalls` admits on that type's prototype — the same
    // claim `./types.ts` makes at the type level — and every entry is a
    // body.
    keys: () => {
        assertEq(Object.keys(runtime).toSorted().join(), 'member,static')
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
    // Every path the static section holds is admitted, and every entry is
    // a body: a namespace's members, or the function a global is.
    staticPaths: () => {
        /** @type {Readonly<Record<string, unknown>>} */
        const section = runtime.static
        for (const [global, value] of entries(section)) {
            if (typeof value === 'function') {
                assert(isStatic([global]), global)
                continue
            }
            for (const [name, entry] of entries(/** @type {Readonly<Record<string, unknown>>} */ (value))) {
                assert(isStatic([global, name]), `${global}.${name}`)
                assertEq(typeof entry, 'function')
            }
        }
    },
    // `Object.is` is the helper itself, SameValue: `-0` and `0` differ,
    // `NaN` is itself.
    objectIs: () => {
        assertEq(runtime.static.Object.is, is)
        assertEq(runtime.static.Object.is(-0, 0), false)
        assertEq(runtime.static.Object.is(NaN, NaN), true)
        assertEq(runtime.static.Object.is('a', 'a'), true)
    },
    // The four `Number` predicates are the helpers themselves, and each
    // answers as the built-in on every kind of value, none converting:
    // `"1"` and `1n` are no integer, `"NaN"` is no `NaN`.
    numberPredicates: () => {
        const { Number: predicates } = runtime.static
        assertEq(predicates.isInteger, isInteger)
        assertEq(predicates.isSafeInteger, isSafeInteger)
        assertEq(predicates.isNaN, isNaN_)
        assertEq(predicates.isFinite, isFinite_)
        const values = [0, -0, 1, 1.5, 2 ** 53, 2 ** 53 - 1, NaN, Infinity, -Infinity, 1n, '1', 'NaN', true, null, undefined, [], {}]
        for (const name of /** @type {const} */ (['isInteger', 'isSafeInteger', 'isNaN', 'isFinite'])) {
            for (const value of values) { assertEq(predicates[name](value), Number[name](value), [name, value]) }
        }
    },
    // The one member body so far, on the host: `String.prototype.startsWith`'s
    // algorithm, case by case — the search converted, the position clamped
    // and truncated, an empty search found anywhere.
    startsWith: () => {
        const { startsWith } = runtime.member.String
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
        bigintPosition: () => { runtime.member.String.startsWith('abc', 'a', 0n) },
        // The search is converted through its own `toString`, whose throw
        // is the call's; which of two throws wins is pinned where the
        // executors run the body, in `nanvm/corpus` and `vm/runtime.rs`.
        searchConversion: () => { runtime.member.String.startsWith('abc', { toString: () => { throw 'A' } }, 0) },
    },
}
