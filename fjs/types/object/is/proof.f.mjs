import { assertEq } from '../../../asserts/module.f.mjs'
import { is } from './module.f.js'

const array = /** @type {readonly unknown[]} */ ([])
const object = {}
const f = () => 1

/**
 * Every type, with the values `===` and `Object.is` part on: the zeros,
 * `NaN`, the bigint zero, and a container and a function beside a second
 * one of the same shape.
 *
 * @type {readonly unknown[]}
 */
const values = [
    NaN, 0, -0, 1, -1, 1.5, Infinity, -Infinity,
    0n, -0n, 1n, -1n,
    '', '0', 'a',
    true, false, null, undefined,
    array, [], object, {}, f, () => 1,
]

export const proof = {
    everyPair: () => values.forEach(a => values.forEach(b =>
        assertEq(is(a, b), Object.is(a, b), [a, b]))),
    // the two answers `===` gives the other way
    zeros: () => {
        assertEq(is(0, -0), false)
        assertEq(is(-0, 0), false)
        assertEq(is(0, 0), true)
        assertEq(is(-0, -0), true)
        assertEq(is(0n, -0n), true)
    },
    nan: () => {
        assertEq(is(NaN, NaN), true)
        assertEq(is(NaN, 0), false)
        assertEq(is(0, NaN), false)
    },
    // identity, as `===` has it: a container is itself and no other
    identity: () => {
        assertEq(is(array, array), true)
        assertEq(is(array, []), false)
        assertEq(is(object, {}), false)
        assertEq(is(f, f), true)
        assertEq(is(f, () => 1), false)
    },
}
