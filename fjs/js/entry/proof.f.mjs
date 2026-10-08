import { assert, assertEq } from '../../asserts/module.f.mjs'
import { entry } from './module.f.js'

/** @type {(a: unknown, b: any) => unknown} */
const noValue = (a, b) => entry(a, b)

export const proof = {
    // An object's fields, a repeated key's last value among them, and
    // nothing a prototype gives it: the point of the helper.
    object: () => {
        assertEq(entry({ a: 7 }, 'a'), 7)
        assertEq(entry({ a: 7 }, 'b'), undefined)
        assertEq(entry({}, 'toString'), undefined)
        assertEq(entry({ ['__proto__']: 42 }, '__proto__'), 42)
        assertEq(entry({ length: 3 }, 'length'), 3)
        assertEq(entry({ a: undefined }, 'a'), undefined)
    },
    // An array's and a string's elements by their canonical index, and
    // never their `length`, which both own without enumerating it.
    elements: () => {
        assertEq(entry([7, 8], 1), 8)
        assertEq(entry([7, 8], '1'), 8)
        assertEq(entry([7, 8], '01'), undefined)
        assertEq(entry([7, 8], 2), undefined)
        assertEq(entry([7, 8], 'length'), undefined)
        assertEq(entry('ab', 1), 'b')
        assertEq(entry('ab', '1'), 'b')
        assertEq(entry('ab', 'length'), undefined)
    },
    // A function has no entry at all, its `length` and `name` being own
    // and not enumerable — which is what keeps a function's name out of
    // the language — and neither has any other primitive.
    none: () => {
        assertEq(entry(entry, 'length'), undefined)
        assertEq(entry(entry, 'name'), undefined)
        assertEq(entry(() => 1, 'name'), undefined)
        assertEq(entry(5, 'a'), undefined)
        assertEq(entry(true, '0'), undefined)
        assertEq(entry(5n, 'a'), undefined)
    },
    // The key converts as `Object.getOwnPropertyDescriptor` converts one:
    // through `ToPropertyKey`, which is `String` for everything the
    // language has — a number by its decimal spelling, `-0` as `"0"`, an
    // object through its own `toString`.
    keys: () => {
        assertEq(entry({ 1: 42 }, 1), 42)
        assertEq(entry({ 0: 42 }, -0), 42)
        assertEq(entry({ true: 42 }, true), 42)
        assertEq(entry({ null: 42 }, null), 42)
        assertEq(entry({ undefined: 42 }, undefined), 42)
        assertEq(entry({ 5: 42 }, 5n), 42)
        assertEq(entry({ 1: 42 }, [1]), 42)
        assertEq(entry({ '[object Object]': 42 }, {}), 42)
        assertEq(entry({ k: 42 }, { toString: () => 'k' }), 42)
    },
    // A function like any other: two parameters, and a value to pass.
    function: () => {
        assertEq(entry.length, 2)
        assertEq(typeof entry, 'function')
        assertEq(noValue({ a: 1 }, 'a'), 1)
        assert([1, 2].map(entry).every(v => v === undefined))
    },
    throw: {
        nullReceiver: () => { entry(null, 'a') },
        undefinedReceiver: () => { entry(undefined, 'a') },
        keyConversion: () => { entry({}, { toString: () => { throw 'key' } }) },
    },
}
