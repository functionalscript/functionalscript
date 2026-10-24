import { assertEq } from '../../asserts/module.f.js'
import { more, read } from './module.f.mjs'

export const proof = {
    // The first bit is the lowest of the first byte.
    low: () => {
        assertEq(read([0b1010_0101], 0, 1), 1)
        assertEq(read([0b1010_0101], 1, 1), 0)
        assertEq(read([0b1010_0101], 0, 3), 0b101)
        assertEq(read([0b1010_0101], 2, 4), 0b1001)
        assertEq(read([0b1010_0101], 0, 8), 0b1010_0101)
    },
    // A number runs across bytes, the earlier byte the lower.
    across: () => {
        assertEq(read([0x34, 0x12], 0, 16), 0x1234)
        assertEq(read([0x34, 0x12], 4, 8), 0x23)
        assertEq(read([0xf0, 0xff, 0x0f], 4, 16), 0xffff)
        assertEq(read([0xff, 0xff, 0xff], 7, 16), 0xffff)
        assertEq(read([0, 0, 0x01], 7, 16), 0x0200)
    },
    // Nothing is read for no bits, wherever the input ends.
    none: () => {
        assertEq(read([], 0, 0), 0)
        assertEq(read([0xff], 99, 0), 0)
    },
    // The input is shorter than the bits it is asked for.
    short: () => {
        assertEq(read([], 0, 1), more)
        assertEq(read([0xff], 8, 1), more)
        assertEq(read([0xff], 0, 9), more)
        assertEq(read([0xff], 4, 5), more)
        assertEq(read([0xff, 0xff], 7, 10), more)
        // the last bit there is
        assertEq(read([0xff], 7, 1), 1)
    },
    throw: {
        // The most a read takes is sixteen bits.
        tooMany: () => read([0, 0, 0, 0], 0, 17),
    },
}
