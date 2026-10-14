import { assert, assertEq } from '../../asserts/module.f.mjs'
import {
    allowedCalls, arrayPrototype, bigintPrototype, booleanPrototype, functionPrototype, numberPrototype,
    objectPrototype, stringPrototype,
} from '../prototype/module.f.js'
import { isStatic, statics } from '../static/module.f.js'
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

/** The static section by path, for a proof that walks it. @type {Readonly<Record<string, Readonly<Record<string, (a: unknown, b: unknown) => unknown>>>>} */
const section = runtime.static

/** The host's own globals, each static path read from them as from the section. @type {typeof section} */
const host = /** @type {typeof section} */ (/** @type {unknown} */ ({ Object, Number }))

const array = /** @type {readonly unknown[]} */ ([])
const object = {}
const f = () => 1

/**
 * Every type, with the values the static functions part on: the zeros and
 * `NaN`, the infinities, fractions, the bounds of the safe integers and
 * the first integers past them, the largest double and the least, numeric
 * strings, the bigint zeros, and a container and a function beside a
 * second one of the same shape. A static body is called on every pair, so
 * a two-argument function meets every combination and a one-argument one
 * every value, its second argument ignored as the host ignores it.
 *
 * @type {readonly unknown[]}
 */
const samples = [
    NaN, 0, -0, 1, -1, 0.5, -0.5, 1.5, -1.5, Infinity, -Infinity,
    0x1f_ffff_ffff_ffff, -0x1f_ffff_ffff_ffff, 0x20_0000_0000_0000, -0x20_0000_0000_0000,
    1e100, 1.7976931348623157e308, -1.7976931348623157e308, 5e-324, -5e-324,
    0n, -0n, 1n, -1n,
    '', '0', '1', 'a', 'NaN', 'Infinity',
    true, false, null, undefined,
    array, [], [1], [NaN], object, {}, f, () => 1,
]

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
    // Every admitted static is bound, and each body answers as the host's
    // own built-in at the same path — its `length`, and its answer on every
    // pair of values — so a body is the built-in, value for value, and not
    // only on the cases written out for it. The built-in is called both
    // ways JavaScript calls it: as a method of its namespace, `Object.is(a,
    // b)`, and detached, `this` undefined, as `const { is } = Object;
    // is(a, b)` calls it — destructuring being sugar for the read, an
    // admitted static must answer alike either way
    // (`../static/module.f.js`), and a built-in that reads `this` throws
    // here on every engine the suite runs on.
    host: () => {
        for (const [global, name] of statics) {
            const body = section[global][name]
            const namespace = host[global]
            const detached = namespace[name]
            assertEq(body.length, detached.length, [global, name])
            for (const a of samples) {
                for (const b of samples) {
                    const expected = body(a, b)
                    assertEq(namespace[name](a, b), expected, [global, name, 'method', a, b])
                    assertEq(detached(a, b), expected, [global, name, 'detached', a, b])
                }
            }
        }
    },
    // The two values `===` reads the other way, which `Object.is` exists
    // for, and none of the four predicates converting its argument, are the
    // cases `host` must not miss; they are in `samples`, and pinned here too.
    edges: () => {
        const { Object: o, Number: n } = runtime.static
        assertEq(o.is(0, -0), false)
        assertEq(o.is(NaN, NaN), true)
        assertEq(o.is(array, []), false)
        assertEq(n.isInteger('1'), false)
        assertEq(n.isSafeInteger(0x20_0000_0000_0000), false)
        assertEq(n.isNaN('NaN'), false)
        assertEq(n.isFinite('1'), false)
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
        // The detached call `host` makes is a real one: a built-in that
        // builds with `this` as its constructor, which no static may be,
        // throws called so.
        detachedThis: () => {
            const { from } = Uint8Array
            from([1])
        },
        // A bigint position is the `TypeError` `ToNumber` throws.
        bigintPosition: () => { runtime.member.String.startsWith('abc', 'a', 0n) },
        // The search is converted through its own `toString`, whose throw
        // is the call's; which of two throws wins is pinned where the
        // executors run the body, in `nanvm/corpus` and `vm/runtime.rs`.
        searchConversion: () => { runtime.member.String.startsWith('abc', { toString: () => { throw 'A' } }, 0) },
    },
}
