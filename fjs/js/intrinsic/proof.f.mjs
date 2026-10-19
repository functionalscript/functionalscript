import { assert, assertEq } from '../../asserts/module.f.mjs'
import { intrinsics } from '../../edag/module.f.mjs'
import { slice } from './module.f.js'

/** The helper on any receiver, as the intrinsic is. @type {(s: unknown, start: unknown, end: unknown) => unknown} */
const any = /** @type {(s: unknown, start: unknown, end: unknown) => unknown} */ (/** @type {unknown} */ (slice))

export const proof = {
    // The helper is `String.prototype.slice` of its first argument: the
    // substring, positions clamped, a negative one from the end, an
    // omitted end the string's.
    slice: () => {
        assertEq(slice('abcdef', 1, 3), 'bc')
        assertEq(slice('abcdef', 2), 'cdef')
        assertEq(slice('abcdef'), 'abcdef')
        assertEq(slice('abcdef', -2), 'ef')
        assertEq(slice('abcdef', 4, 2), '')
        assertEq(slice('abcdef', 0, 100), 'abcdef')
        assertEq(slice('', 0, 1), '')
    },
    // The intrinsic is the member call on any receiver: an array's
    // `slice`, and an own property first, as the executors answer it.
    receiver: () => {
        const f = () => 'own'
        assertEq(JSON.stringify(any([1, 2, 3], 1, 2)), '[2]')
        assertEq(any({ slice: f }, 0, 0), 'own')
    },
    // Every intrinsic's `length` is the one `fjs/edag` lists for it, the
    // receiver and the native's positions, and every listed name is a
    // helper here.
    length: () => {
        const helpers = /** @type {Readonly<Record<string, (...args: never[]) => unknown>>} */ ({ slice })
        assertEq(intrinsics.length, Object.entries(helpers).length)
        for (const [id, length] of intrinsics) {
            const helper = helpers[id]
            assert(helper !== undefined, id)
            assertEq(helper.length, length, id)
        }
    },
    throw: {
        // a nullish receiver throws, as the member call throws
        nullish: () => { any(null, 0, 1) },
        // a receiver without the member throws, calling `undefined`
        number: () => { any(5, 0, 1) },
    },
}
