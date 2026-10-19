import { assert, assertEq, assertStructurallySame } from '../../../asserts/module.f.mjs'
import { entry, hasEntry } from './module.f.js'

/** @type {(a: unknown, b: any) => unknown} */
const noValue = (a, b) => entry(a, b)

/** @type {(a: unknown, b: any, expected: unknown) => void} */
const some = (a, b, expected) => {
    assertEq(hasEntry(a, b), true)
    assertEq(entry(a, b), expected)
}

/** @type {(a: unknown, b: any) => void} */
const none = (a, b) => {
    assertEq(hasEntry(a, b), false)
    assertEq(entry(a, b), undefined)
}

export const proof = {
    // An object's fields, a repeated key's last value among them, and
    // nothing a prototype gives it: the point of the helper. An entry
    // holding `undefined` reads as none and is one, which `hasEntry` tells.
    object: () => {
        some({ a: 7 }, 'a', 7)
        none({ a: 7 }, 'b')
        none({}, 'toString')
        // A computed __proto__ key is an own data field, not a prototype setter.
        some({ ['__proto__']: 42 }, '__proto__', 42)
        some({ length: 3 }, 'length', 3)
        some({ a: undefined }, 'a', undefined)
        none({}, 'a')
    },
    // An array's and a string's elements by their canonical index, and
    // never their `length`, which both own without enumerating it.
    elements: () => {
        some([7, 8], 1, 8)
        some([7, 8], '1', 8)
        none([7, 8], '01')
        none([7, 8], 2)
        none([7, 8], 'length')
        some('ab', 1, 'b')
        some('ab', '1', 'b')
        none('ab', 'length')
    },
    // A function has no entry at all, its `length` and `name` being own
    // and not enumerable — which is what keeps a function's name out of
    // the language — and neither has any other primitive.
    none: () => {
        none(entry, 'length')
        none(entry, 'name')
        none(hasEntry, 'length')
        none(() => 1, 'name')
        none(5, 'a')
        none(true, '0')
        none(5n, 'a')
    },
    // The key converts as `Object.getOwnPropertyDescriptor` converts one:
    // through `ToPropertyKey`, which is `String` for everything the
    // language has — a number by its decimal spelling, `-0` as `"0"`, an
    // object through its own `toString`.
    keys: () => {
        some({ 1: 42 }, 1, 42)
        some({ 0: 42 }, -0, 42)
        some({ true: 42 }, true, 42)
        some({ null: 42 }, null, 42)
        some({ undefined: 42 }, undefined, 42)
        some({ 5: 42 }, 5n, 42)
        some({ 1: 42 }, [1], 42)
        some({ '[object Object]': 42 }, {}, 42)
        some({ k: 42 }, { toString: () => 'k' }, 42)
    },
    // The value composes as a value: a default through `??`, which an entry
    // holding `undefined` takes too, and the presence through `hasEntry`
    // where that matters.
    value: () => {
        const o = { a: 1, u: undefined }
        assertEq(entry(o, 'a') ?? 'fallback', 1)
        assertEq(entry(o, 'u') ?? 'fallback', 'fallback')
        assertEq(hasEntry(o, 'u') ? entry(o, 'u') : 'fallback', undefined)
        assertEq(entry(o, 'b') ?? 'fallback', 'fallback')
        assertStructurallySame(['a', 'b', 'u', 'a'].map(k => entry(o, k)), [1, undefined, undefined, 1])
    },
    // A function like any other: two parameters, and a value to pass.
    function: () => {
        assertEq(entry.length, 2)
        assertEq(hasEntry.length, 2)
        assertEq(typeof entry, 'function')
        assertEq(noValue({ a: 1 }, 'a'), 1)
        assertStructurallySame([1, 2].map(entry), [undefined, undefined])
        assertStructurallySame([{ 0: 1 }, {}].map(hasEntry), [true, false])
    },
    throw: {
        hasEntryNullish: () => { hasEntry(null, 'a') },
        nullReceiver: () => { entry(null, 'a') },
        undefinedReceiver: () => { entry(undefined, 'a') },
        keyConversion: () => { entry({}, { toString: () => { throw 'key' } }) },
    },
}
