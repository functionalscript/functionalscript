import { assertEq } from '../../../asserts/module.f.js'
import { host } from './module.f.js'

/** Bigints, one past a word, and a value of another kind. */
const values = [1n, 1n, -1n, 1n << 64n, 1 << 30, 'a']

const h = host(values)

export const proof = {
    // A handle names a value of the table, and each import is its row on the values or the floats.
    bigintEquals: () => {
        assertEq(h.bigintEquals(0n, 1n), 1)
        assertEq(h.bigintEquals(0n, 2n), 0)
        assertEq(h.bigintEquals(3n, 3n), 1)
    },
    numberRemainder: () => {
        assertEq(h.numberRemainder(5.5, 2), 1.5)
        assertEq(h.numberRemainder(-7, 2), -1)
    },
    // Where the row throws, so does the import: a value of another kind, or a handle of none.
    throw: {
        notBigint: () => { h.bigintEquals(0n, 4n) },
        notHandle: () => { h.bigintEquals(0n, 6n) },
    },
}
